import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSuggestions } from "../utils/validateSuggestions.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function make(overrides = {}) {
  return {
    type: "performance",
    message: "Reduce server response time.",
    impact: "high",
    ...overrides,
  };
}

// ── Valid suggestions ─────────────────────────────────────────────────────────

describe("validateSuggestions — valid suggestions", () => {
  it("accepts all four valid types", () => {
    for (const type of ["performance", "bundle", "image", "rendering"]) {
      const result = validateSuggestions([make({ type })], "test");
      assert.equal(result.length, 1, `expected type "${type}" to be accepted`);
    }
  });

  it("accepts all three valid impact levels", () => {
    for (const impact of ["high", "medium", "low"]) {
      const result = validateSuggestions([make({ impact })], "test");
      assert.equal(result.length, 1, `expected impact "${impact}" to be accepted`);
    }
  });

  it("accepts a fully valid suggestion", () => {
    const suggestions = [make()];
    const result = validateSuggestions(suggestions, "test");
    assert.deepEqual(result, suggestions);
  });

  it("passes through all valid suggestions in a mixed-valid array", () => {
    const suggestions = [
      make({ type: "bundle", impact: "medium" }),
      make({ type: "image", impact: "low" }),
    ];
    const result = validateSuggestions(suggestions, "test");
    assert.equal(result.length, 2);
  });
});

// ── Invalid type ──────────────────────────────────────────────────────────────

describe("validateSuggestions — invalid type", () => {
  it("rejects an unknown type", () => {
    const result = validateSuggestions([make({ type: "seo" })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects an empty type string", () => {
    const result = validateSuggestions([make({ type: "" })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects a whitespace-only type", () => {
    const result = validateSuggestions([make({ type: "   " })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects a non-string type", () => {
    const result = validateSuggestions([make({ type: 42 })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects a null type", () => {
    const result = validateSuggestions([make({ type: null })], "test");
    assert.equal(result.length, 0);
  });
});

// ── Invalid impact ────────────────────────────────────────────────────────────

describe("validateSuggestions — invalid impact", () => {
  it("rejects an unknown impact", () => {
    const result = validateSuggestions([make({ impact: "critical" })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects an empty impact string", () => {
    const result = validateSuggestions([make({ impact: "" })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects a whitespace-only impact", () => {
    const result = validateSuggestions([make({ impact: "  " })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects a non-string impact", () => {
    const result = validateSuggestions([make({ impact: true })], "test");
    assert.equal(result.length, 0);
  });
});

// ── Invalid message ───────────────────────────────────────────────────────────

describe("validateSuggestions — invalid message", () => {
  it("rejects an empty message", () => {
    const result = validateSuggestions([make({ message: "" })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects a whitespace-only message", () => {
    const result = validateSuggestions([make({ message: "   " })], "test");
    assert.equal(result.length, 0);
  });

  it("rejects a missing message field", () => {
    const { message: _omit, ...noMessage } = make();
    const result = validateSuggestions([noMessage], "test");
    assert.equal(result.length, 0);
  });
});

// ── Non-array input ───────────────────────────────────────────────────────────

describe("validateSuggestions — non-array input", () => {
  it("returns empty array for a plain object", () => {
    const result = validateSuggestions(make(), "test");
    assert.deepEqual(result, []);
  });

  it("returns empty array for null", () => {
    const result = validateSuggestions(null, "test");
    assert.deepEqual(result, []);
  });

  it("returns empty array for a string", () => {
    const result = validateSuggestions("suggestion", "test");
    assert.deepEqual(result, []);
  });

  it("returns empty array for undefined", () => {
    const result = validateSuggestions(undefined, "test");
    assert.deepEqual(result, []);
  });
});

// ── Mixed AI response (valid + invalid together) ──────────────────────────────

describe("validateSuggestions — mixed AI responses", () => {
  it("filters out invalid suggestions while keeping valid ones", () => {
    const suggestions = [
      make({ type: "performance", impact: "high" }),         // valid
      make({ type: "seo", impact: "high" }),                 // bad type
      make({ type: "bundle", impact: "critical" }),          // bad impact
      make({ type: "image", message: "", impact: "low" }),   // empty message
      make({ type: "rendering", impact: "medium" }),         // valid
    ];
    const result = validateSuggestions(suggestions, "test");
    assert.equal(result.length, 2);
    assert.equal(result[0].type, "performance");
    assert.equal(result[1].type, "rendering");
  });

  it("returns empty array when every suggestion is invalid", () => {
    const suggestions = [
      make({ type: "seo" }),
      make({ impact: "urgent" }),
      make({ message: "  " }),
    ];
    const result = validateSuggestions(suggestions, "test");
    assert.deepEqual(result, []);
  });

  it("returns all suggestions when every one is valid", () => {
    const suggestions = [
      make({ type: "performance", impact: "high" }),
      make({ type: "bundle", impact: "medium" }),
      make({ type: "image", impact: "low" }),
      make({ type: "rendering", impact: "high" }),
    ];
    const result = validateSuggestions(suggestions, "test");
    assert.equal(result.length, 4);
  });
});
