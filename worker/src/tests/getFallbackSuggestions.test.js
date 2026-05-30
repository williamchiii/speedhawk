import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getFallbackSuggestions } from "../utils/validateSuggestions.js";

// Baseline "healthy" metrics — every threshold passes, so only the
// catch-all suggestion should be produced unless a test overrides a value.
function metrics(overrides = {}) {
  return {
    score: 95,
    ttfb: 200,
    fcp: 1000,
    lcp: 1500,
    bundleSize: 200,
    ...overrides,
  };
}

// Every fallback suggestion must satisfy the same schema validateSuggestions enforces,
// otherwise the DB insert in processAudit would fail.
const VALID_TYPES = new Set(["performance", "bundle", "image", "rendering"]);
const VALID_IMPACTS = new Set(["high", "medium", "low"]);

function assertWellFormed(suggestions) {
  for (const s of suggestions) {
    assert.ok(VALID_TYPES.has(s.type), `unexpected type "${s.type}"`);
    assert.ok(VALID_IMPACTS.has(s.impact), `unexpected impact "${s.impact}"`);
    assert.ok(typeof s.message === "string" && s.message.trim().length > 0);
  }
}

// ── Always returns at least one well-formed suggestion ─────────────────────────

describe("getFallbackSuggestions — guarantees", () => {
  it("always returns at least one suggestion, even for a healthy page", () => {
    const result = getFallbackSuggestions(metrics());
    assert.ok(result.length >= 1);
  });

  it("falls back to the score-based catch-all when no threshold is breached", () => {
    const result = getFallbackSuggestions(metrics({ score: 88 }));
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "performance");
    assert.equal(result[0].impact, "medium");
    assert.ok(result[0].message.includes("88"), "catch-all should mention the score");
  });

  it("produces only schema-valid suggestions across many metric combinations", () => {
    const combos = [
      metrics(),
      metrics({ lcp: 5000, bundleSize: 1500, fcp: 4000, ttfb: 1200 }),
      metrics({ lcp: 3000, bundleSize: 700 }),
      metrics({ score: 10, lcp: 9000, bundleSize: 9000, fcp: 9000, ttfb: 9000 }),
    ];
    for (const m of combos) {
      assertWellFormed(getFallbackSuggestions(m));
    }
  });
});

// ── LCP thresholds ─────────────────────────────────────────────────────────────

describe("getFallbackSuggestions — LCP", () => {
  it("flags critically slow LCP (>4000ms) as high impact", () => {
    const result = getFallbackSuggestions(metrics({ lcp: 4500 }));
    const lcp = result.find((s) => s.message.includes("LCP"));
    assert.ok(lcp, "expected an LCP suggestion");
    assert.equal(lcp.impact, "high");
    assert.ok(lcp.message.includes("critically"));
  });

  it("flags LCP between 2500 and 4000ms as high impact (good-threshold message)", () => {
    const result = getFallbackSuggestions(metrics({ lcp: 3000 }));
    const lcp = result.find((s) => s.message.includes("LCP"));
    assert.ok(lcp);
    assert.equal(lcp.impact, "high");
    assert.ok(lcp.message.includes("good"));
  });

  it("does not flag LCP at the 2500ms boundary", () => {
    const result = getFallbackSuggestions(metrics({ lcp: 2500 }));
    assert.ok(!result.some((s) => s.message.includes("LCP")));
  });

  it("emits only one LCP suggestion for a critically slow value", () => {
    const result = getFallbackSuggestions(metrics({ lcp: 5000 }));
    const lcpCount = result.filter((s) => s.message.includes("LCP")).length;
    assert.equal(lcpCount, 1);
  });
});

// ── Bundle size thresholds ─────────────────────────────────────────────────────

describe("getFallbackSuggestions — bundle size", () => {
  it("flags very large page weight (>1000KB) as high impact", () => {
    const result = getFallbackSuggestions(metrics({ bundleSize: 1500 }));
    const bundle = result.find((s) => s.type === "bundle");
    assert.ok(bundle);
    assert.equal(bundle.impact, "high");
    assert.ok(bundle.message.includes("1500KB"), "should mention the actual size");
  });

  it("flags large page weight (>500KB) as medium impact", () => {
    const result = getFallbackSuggestions(metrics({ bundleSize: 700 }));
    const bundle = result.find((s) => s.type === "bundle");
    assert.ok(bundle);
    assert.equal(bundle.impact, "medium");
    assert.ok(bundle.message.includes("700KB"));
  });

  it("does not flag bundle size at the 500KB boundary", () => {
    const result = getFallbackSuggestions(metrics({ bundleSize: 500 }));
    assert.ok(!result.some((s) => s.type === "bundle"));
  });
});

// ── FCP threshold ───────────────────────────────────────────────────────────────

describe("getFallbackSuggestions — FCP", () => {
  it("flags slow FCP (>3000ms) as a high-impact rendering issue", () => {
    const result = getFallbackSuggestions(metrics({ fcp: 3500 }));
    const fcp = result.find((s) => s.type === "rendering");
    assert.ok(fcp);
    assert.equal(fcp.impact, "high");
  });

  it("does not flag FCP at the 3000ms boundary", () => {
    const result = getFallbackSuggestions(metrics({ fcp: 3000 }));
    assert.ok(!result.some((s) => s.type === "rendering"));
  });
});

// ── TTFB threshold ──────────────────────────────────────────────────────────────

describe("getFallbackSuggestions — TTFB", () => {
  it("flags slow server response (>800ms) as medium impact", () => {
    const result = getFallbackSuggestions(metrics({ ttfb: 1200 }));
    const ttfb = result.find((s) => s.message.includes("Server response time"));
    assert.ok(ttfb);
    assert.equal(ttfb.impact, "medium");
    assert.ok(ttfb.message.includes("1200ms"));
  });

  it("does not flag TTFB at the 800ms boundary", () => {
    const result = getFallbackSuggestions(metrics({ ttfb: 800 }));
    assert.ok(!result.some((s) => s.message.includes("Server response time")));
  });
});

// ── Combined / ordering ─────────────────────────────────────────────────────────

describe("getFallbackSuggestions — multiple breaches", () => {
  it("accumulates suggestions for every breached threshold and drops the catch-all", () => {
    const result = getFallbackSuggestions(
      metrics({ lcp: 5000, bundleSize: 1500, fcp: 3500, ttfb: 1200 }),
    );
    // LCP + bundle + FCP + TTFB = 4 specific suggestions, no catch-all.
    assert.equal(result.length, 4);
    assert.ok(!result.some((s) => s.message.includes("Review Core Web Vitals")));
  });

  it("preserves the LCP → bundle → FCP → TTFB ordering", () => {
    const result = getFallbackSuggestions(
      metrics({ lcp: 5000, bundleSize: 1500, fcp: 3500, ttfb: 1200 }),
    );
    assert.ok(result[0].message.includes("LCP"));
    assert.equal(result[1].type, "bundle");
    assert.equal(result[2].type, "rendering");
    assert.ok(result[3].message.includes("Server response time"));
  });
});
