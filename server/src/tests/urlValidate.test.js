import { describe, it, expect } from "vitest";
import { isValidURL, normalizeURL } from "../utils/urlValidate.js";

describe("normalizeURL", () => {
  it("returns null for missing value", () => {
    expect(normalizeURL(undefined)).toBeNull();
    expect(normalizeURL(null)).toBeNull();
  });

  it("returns null for non-string inputs", () => {
    expect(normalizeURL(123)).toBeNull();
    expect(normalizeURL({})).toBeNull();
    expect(normalizeURL([])).toBeNull();
  });

  it("returns null for empty or whitespace-only strings", () => {
    expect(normalizeURL("")).toBeNull();
    expect(normalizeURL("   ")).toBeNull();
  });

  it("prepends https:// when protocol is missing", () => {
    expect(normalizeURL("example.com")).toBe("https://example.com");
  });

  it("leaves existing http/https protocol untouched", () => {
    expect(normalizeURL("https://example.com")).toBe("https://example.com");
    expect(normalizeURL("http://example.com")).toBe("http://example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeURL("  example.com  ")).toBe("https://example.com");
  });
});

describe("isValidURL", () => {
  it("accepts valid https URLs", () => {
    expect(isValidURL("https://example.com")).toBe(true);
  });

  it("accepts valid http URLs", () => {
    expect(isValidURL("http://example.com")).toBe(true);
  });

  it("rejects URLs without a dot in hostname", () => {
    expect(isValidURL("https://localhost")).toBe(false);
  });

  it("rejects non-http protocols", () => {
    expect(isValidURL("ftp://example.com")).toBe(false);
  });

  it("rejects null and non-string inputs without throwing", () => {
    expect(isValidURL(null)).toBe(false);
    expect(isValidURL(undefined)).toBe(false);
    expect(isValidURL(123)).toBe(false);
  });
});
