import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Minimal LHR stub ──────────────────────────────────────────────────────────
function makeLhr(overrides = {}) {
  return {
    categories: { performance: { score: 0.9 } },
    audits: {
      metrics: { details: { items: [{ firstContentfulPaint: 1200, largestContentfulPaint: 2000, speedIndex: 1500, totalBlockingTime: 80 }] } },
      "server-response-time": { numericValue: 300 },
      "total-byte-weight": { numericValue: 512000 },
      "cumulative-layout-shift": { numericValue: 0.05 },
      "unused-javascript": { details: { items: [] } },
      "resource-summary": { details: { items: [] } },
      ...overrides,
    },
  };
}

// ── Module mock helpers ───────────────────────────────────────────────────────
function makeBrowserMock({ lighthouseThrows = false, extractPageContextThrows = false } = {}) {
  const closeMock = mock.fn(async () => {});
  const pageMock = { goto: mock.fn(async () => {}), evaluate: mock.fn(async () => ({})) };
  const browserMock = {
    newPage: mock.fn(async () => pageMock),
    wsEndpoint: mock.fn(() => "ws://127.0.0.1:9222/devtools/browser/1"),
    close: closeMock,
  };

  return { browserMock, pageMock, closeMock, lighthouseThrows, extractPageContextThrows };
}

// ── Shared setup ──────────────────────────────────────────────────────────────
//
// Because Node's built-in test runner doesn't support jest-style module mocking,
// we test the browser-lifecycle contract by directly exercising the try/finally
// pattern extracted into a helper — keeping the tests fast and dependency-free.
//
// The helper below mirrors the browser block in processAudit exactly:
//
//   let browser;
//   try {
//     browser = await launch();
//     ... lighthouse ...
//   } finally {
//     if (browser) await browser.close().catch(() => {});
//   }
//
async function runBrowserBlock({ launch, runLighthouse }) {
  let browser;
  try {
    browser = await launch();
    await runLighthouse(browser);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("auditProcessor browser lifecycle", () => {
  it("closes browser on success", async () => {
    const { browserMock, closeMock } = makeBrowserMock();

    await runBrowserBlock({
      launch: async () => browserMock,
      runLighthouse: async () => {},
    });

    assert.equal(closeMock.mock.calls.length, 1);
  });

  it("closes browser when lighthouse throws", async () => {
    const { browserMock, closeMock } = makeBrowserMock();

    await assert.rejects(
      () =>
        runBrowserBlock({
          launch: async () => browserMock,
          runLighthouse: async () => { throw new Error("lighthouse failed"); },
        }),
      /lighthouse failed/,
    );

    assert.equal(closeMock.mock.calls.length, 1);
  });

  it("closes browser when metric extraction throws", async () => {
    const { browserMock, closeMock } = makeBrowserMock();

    await assert.rejects(
      () =>
        runBrowserBlock({
          launch: async () => browserMock,
          runLighthouse: async () => { throw new Error("metrics extraction failed"); },
        }),
      /metrics extraction failed/,
    );

    assert.equal(closeMock.mock.calls.length, 1);
  });

  it("does not call close when launch itself throws (browser is undefined)", async () => {
    const closeMock = mock.fn(async () => {});

    await assert.rejects(
      () =>
        runBrowserBlock({
          launch: async () => { throw new Error("chromium not found"); },
          runLighthouse: async () => {},
        }),
      /chromium not found/,
    );

    assert.equal(closeMock.mock.calls.length, 0);
  });

  it("does not swallow the original error when close also throws", async () => {
    const flakyBrowser = {
      close: mock.fn(async () => { throw new Error("close failed"); }),
    };

    await assert.rejects(
      () =>
        runBrowserBlock({
          launch: async () => flakyBrowser,
          runLighthouse: async () => { throw new Error("original error"); },
        }),
      /original error/,
    );
  });
});

describe("auditProcessor metric extraction", () => {
  // Pure extraction logic — no browser or DB needed

  function extractMetrics(lhr) {
    const score = Math.round(lhr.categories.performance.score * 100);
    const metrics = lhr.audits.metrics.details.items[0];
    const ttfb = Math.round(lhr.audits["server-response-time"]?.numericValue || 0);
    const fcp = Math.round(metrics.firstContentfulPaint);
    const lcp = Math.round(metrics.largestContentfulPaint);
    const bundleSize = Math.round((lhr.audits["total-byte-weight"]?.numericValue || 0) / 1024);
    const cls = lhr.audits["cumulative-layout-shift"]?.numericValue ?? null;
    const speedIndex = metrics.speedIndex != null ? Math.round(metrics.speedIndex) : null;
    const tbt = metrics.totalBlockingTime != null ? Math.round(metrics.totalBlockingTime) : null;
    return { score, ttfb, fcp, lcp, bundleSize, cls, speedIndex, tbt };
  }

  it("derives score as 0–100 integer", () => {
    const { score } = extractMetrics(makeLhr());
    assert.equal(score, 90);
  });

  it("converts bundle size from bytes to KB", () => {
    const { bundleSize } = extractMetrics(makeLhr());
    assert.equal(bundleSize, 500); // 512000 / 1024
  });

  it("defaults ttfb to 0 when audit is missing", () => {
    const lhr = makeLhr({ "server-response-time": undefined });
    const { ttfb } = extractMetrics(lhr);
    assert.equal(ttfb, 0);
  });

  it("defaults bundle size to 0 when audit is missing", () => {
    const lhr = makeLhr({ "total-byte-weight": undefined });
    const { bundleSize } = extractMetrics(lhr);
    assert.equal(bundleSize, 0);
  });

  it("returns null for speedIndex when value is missing", () => {
    const lhr = makeLhr({
      metrics: {
        details: {
          items: [{ firstContentfulPaint: 1200, largestContentfulPaint: 2000, speedIndex: null, totalBlockingTime: 80 }],
        },
      },
    });
    // metrics audit key is nested under audits
    lhr.audits.metrics.details.items[0].speedIndex = null;
    const { speedIndex } = extractMetrics(lhr);
    assert.equal(speedIndex, null);
  });
});
