import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractPageContext } from "../utils/extractPageContext.js";

// Minimal lhr stub — only populate the audits each test needs
function makeLhr(audits = {}) {
  return { audits };
}

describe("getActionableAudits", () => {
  it("includes audits that scored below 0.9", async () => {
    const lhr = makeLhr({
      "unused-javascript": {
        title: "Remove unused JavaScript",
        score: 0.5,
        displayValue: "Potential savings of 120 KiB",
        description: "Remove unused JavaScript to reduce bytes.",
      },
    });
    const { actionableAudits } = await extractPageContext(lhr);
    assert.equal(actionableAudits.length, 1);
    assert.equal(actionableAudits[0].id, "unused-javascript");
    assert.equal(actionableAudits[0].score, 0.5);
  });

  it("excludes audits that passed (score >= 0.9)", async () => {
    const lhr = makeLhr({
      "unused-javascript": {
        title: "Remove unused JavaScript",
        score: 0.95,
        displayValue: null,
        description: "Remove unused JavaScript.",
      },
    });
    const { actionableAudits } = await extractPageContext(lhr);
    assert.equal(actionableAudits.length, 0);
  });

  it("excludes notApplicable and informative audits", async () => {
    const lhr = makeLhr({
      "unused-javascript": { score: 0, scoreDisplayMode: "notApplicable", title: "x", description: "" },
      "dom-size": { score: 0, scoreDisplayMode: "informative", title: "y", description: "" },
    });
    const { actionableAudits } = await extractPageContext(lhr);
    assert.equal(actionableAudits.length, 0);
  });

  it("caps results at 8", async () => {
    const audits = {};
    for (const id of [
      "render-blocking-resources", "render-blocking-insight", "unused-javascript",
      "unused-css-rules", "uses-optimized-images", "uses-responsive-images",
      "offscreen-images", "uses-webp-images", "uses-text-compression",
    ]) {
      audits[id] = { title: id, score: 0.1, displayValue: null, description: "" };
    }
    const { actionableAudits } = await extractPageContext(makeLhr(audits));
    assert.ok(actionableAudits.length <= 8);
  });

  it("strips markdown links from descriptions and truncates to 120 chars", async () => {
    const lhr = makeLhr({
      "unused-javascript": {
        title: "Remove unused JavaScript",
        score: 0.3,
        displayValue: null,
        description: "See [Learn more](https://example.com) for details. " + "x".repeat(200),
      },
    });
    const { actionableAudits } = await extractPageContext(lhr);
    const desc = actionableAudits[0].description;
    assert.ok(!desc.includes("[Learn more]"), "markdown link should be stripped");
    assert.ok(desc.length <= 120, "description should be truncated to 120 chars");
  });

  it("handles missing audits gracefully", async () => {
    const { actionableAudits } = await extractPageContext(makeLhr({}));
    assert.equal(actionableAudits.length, 0);
  });
});

describe("getLargestNetworkResources", () => {
  it("returns resources sorted by transferSize descending", async () => {
    const lhr = makeLhr({
      "network-requests": {
        details: {
          items: [
            { url: "https://example.com/small.js", resourceType: "script", transferSize: 10240 },
            { url: "https://example.com/large.js", resourceType: "script", transferSize: 102400 },
            { url: "https://example.com/font.woff2", resourceType: "font", transferSize: 51200 },
          ],
        },
      },
    });
    const { largestNetworkResources } = await extractPageContext(lhr);
    assert.equal(largestNetworkResources[0].transferKB, 100);
    assert.equal(largestNetworkResources[1].transferKB, 50);
    assert.equal(largestNetworkResources[2].transferKB, 10);
  });

  it("filters out non-relevant resource types like document and xhr", async () => {
    const lhr = makeLhr({
      "network-requests": {
        details: {
          items: [
            { url: "https://example.com/page", resourceType: "document", transferSize: 99999 },
            { url: "https://example.com/api", resourceType: "xhr", transferSize: 99999 },
            { url: "https://example.com/app.js", resourceType: "script", transferSize: 1024 },
          ],
        },
      },
    });
    const { largestNetworkResources } = await extractPageContext(lhr);
    assert.equal(largestNetworkResources.length, 1);
    assert.equal(largestNetworkResources[0].type, "script");
  });

  it("strips query strings from URLs", async () => {
    const lhr = makeLhr({
      "network-requests": {
        details: {
          items: [{ url: "https://example.com/app.js?v=abc123", resourceType: "script", transferSize: 1024 }],
        },
      },
    });
    const { largestNetworkResources } = await extractPageContext(lhr);
    assert.ok(!largestNetworkResources[0].url.includes("?"));
  });

  it("caps results at 8", async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      url: `https://example.com/file${i}.js`,
      resourceType: "script",
      transferSize: 1024 * i,
    }));
    const lhr = makeLhr({ "network-requests": { details: { items } } });
    const { largestNetworkResources } = await extractPageContext(lhr);
    assert.ok(largestNetworkResources.length <= 8);
  });

  it("returns empty array when network-requests audit is absent", async () => {
    const { largestNetworkResources } = await extractPageContext(makeLhr({}));
    assert.deepEqual(largestNetworkResources, []);
  });
});

describe("getRenderBlockingResources", () => {
  it("prefers render-blocking-insight over render-blocking-resources", async () => {
    const lhr = makeLhr({
      "render-blocking-insight": {
        details: { items: [{ url: "https://example.com/critical.css", wastedMs: 400 }] },
      },
      "render-blocking-resources": {
        details: { items: [{ url: "https://example.com/other.css", wastedMs: 200 }] },
      },
    });
    const { renderBlockingResources } = await extractPageContext(lhr);
    assert.ok(renderBlockingResources[0].url.includes("critical.css"));
  });

  it("falls back to render-blocking-resources when insight audit is absent", async () => {
    const lhr = makeLhr({
      "render-blocking-resources": {
        details: { items: [{ url: "https://example.com/legacy.css", wastedMs: 300 }] },
      },
    });
    const { renderBlockingResources } = await extractPageContext(lhr);
    assert.equal(renderBlockingResources.length, 1);
    assert.ok(renderBlockingResources[0].url.includes("legacy.css"));
  });

  it("rounds wastedMs", async () => {
    const lhr = makeLhr({
      "render-blocking-resources": {
        details: { items: [{ url: "https://example.com/a.css", wastedMs: 350.7 }] },
      },
    });
    const { renderBlockingResources } = await extractPageContext(lhr);
    assert.equal(renderBlockingResources[0].wastedMs, 351);
  });

  it("returns empty array when both audits are absent", async () => {
    const { renderBlockingResources } = await extractPageContext(makeLhr({}));
    assert.deepEqual(renderBlockingResources, []);
  });
});

describe("getUnoptimizedImages", () => {
  it("deduplicates the same URL appearing in multiple image audits", async () => {
    const item = { url: "https://example.com/hero.jpg", wastedBytes: 204800 };
    const lhr = makeLhr({
      "uses-optimized-images": { details: { items: [item] } },
      "uses-webp-images": { details: { items: [item] } },
    });
    const { unoptimizedImages } = await extractPageContext(lhr);
    assert.equal(unoptimizedImages.length, 1);
  });

  it("sorts by wastedKB descending", async () => {
    const lhr = makeLhr({
      "uses-optimized-images": {
        details: {
          items: [
            { url: "https://example.com/small.jpg", wastedBytes: 10240 },
            { url: "https://example.com/large.jpg", wastedBytes: 512000 },
          ],
        },
      },
    });
    const { unoptimizedImages } = await extractPageContext(lhr);
    assert.ok(unoptimizedImages[0].wastedKB > unoptimizedImages[1].wastedKB);
  });

  it("converts wastedBytes to KB", async () => {
    const lhr = makeLhr({
      "uses-optimized-images": {
        details: { items: [{ url: "https://example.com/img.jpg", wastedBytes: 51200 }] },
      },
    });
    const { unoptimizedImages } = await extractPageContext(lhr);
    assert.equal(unoptimizedImages[0].wastedKB, 50);
  });

  it("caps results at 6", async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/img${i}.jpg`,
      wastedBytes: 1024 * i,
    }));
    const lhr = makeLhr({ "uses-optimized-images": { details: { items } } });
    const { unoptimizedImages } = await extractPageContext(lhr);
    assert.ok(unoptimizedImages.length <= 6);
  });

  it("returns empty array when no image audits are present", async () => {
    const { unoptimizedImages } = await extractPageContext(makeLhr({}));
    assert.deepEqual(unoptimizedImages, []);
  });
});

describe("getDomMetadata", () => {
  it("returns null when no page is provided", async () => {
    const { domMetadata } = await extractPageContext(makeLhr({}));
    assert.equal(domMetadata, null);
  });

  it("returns null when page.evaluate throws", async () => {
    const badPage = { evaluate: async () => { throw new Error("browser crashed"); } };
    const { domMetadata } = await extractPageContext(makeLhr({}), badPage);
    assert.equal(domMetadata, null);
  });

  it("returns evaluate result when page is provided", async () => {
    const mockResult = {
      title: "My Page",
      metaDescription: "A description",
      scriptCount: 3,
      stylesheetCount: 1,
      imageCount: 5,
      aboveFoldImageUrls: ["example.com/hero.jpg"],
    };
    const mockPage = { evaluate: async () => mockResult };
    const { domMetadata } = await extractPageContext(makeLhr({}), mockPage);
    assert.deepEqual(domMetadata, mockResult);
  });
});
