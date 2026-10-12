// audit.spec.js — Full UI E2E tests.
//
// These tests drive the React client in a real Chromium browser, exercising
// the complete user flow: type a URL → click Audit → watch the polling loop →
// see the results panel render with score, metrics, and suggestions.

import { test, expect } from "@playwright/test";

const AUDIT_URL = "https://playwright.dev";

test.describe("Audit UI — full user flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // ── Page loads ──────────────────────────────────────────────────────────────

  test("homepage renders the URL input and Audit button", async ({ page }) => {
    await expect(page.getByPlaceholder("https://example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Audit" })).toBeVisible();
    await expect(page.getByText("SpeedHawk Audit")).toBeVisible();
  });

  // ── Audit submission and polling ────────────────────────────────────────────

  test(
    "submitting a URL shows the loading state, then renders complete results",
    async ({ page }) => {
      // Fill and submit
      await page.fill('input[placeholder="https://example.com"]', AUDIT_URL);
      await page.getByRole("button", { name: "Audit" }).click();

      // The button should immediately become a spinner while loading
      await expect(page.locator(".loading-spinner")).toBeVisible();

      // A "Created audit…" or "Checking…" status message should appear quickly
      await expect(
        page.locator("text=/Created audit|Checking/"),
      ).toBeVisible({ timeout: 10_000 });

      // Wait for the full audit to complete and results to render.
      // 3-minute timeout covers Lighthouse (slow) + Gemini API.
      await expect(page.getByText("Core Web Vitals")).toBeVisible({
        timeout: 180_000,
      });

      // ── Results panel assertions ───────────────────────────────────────────

      // Score badge is rendered (any integer 0–100)
      const scoreEl = page.locator("text=/%$/");
      await expect(scoreEl.first()).toBeVisible();

      // The audited URL is shown as a link
      await expect(page.getByRole("link", { name: AUDIT_URL })).toBeVisible();

      // Core Web Vitals card has at least TTFB and FCP rows
      await expect(page.getByText("Time to First Byte (TTFB)")).toBeVisible();
      await expect(page.getByText("First Contentful Paint (FCP)")).toBeVisible();
      await expect(page.getByText("Largest Contentful Paint (LCP)")).toBeVisible();

      // Suggestions terminal is rendered
      await expect(
        page.locator("text=/speedhawk — suggestions/"),
      ).toBeVisible();

      // At least one suggestion line (the $ prompt + message)
      const suggestionLines = page.locator(".font-mono p");
      await expect(suggestionLines.first()).toBeVisible();
      expect(await suggestionLines.count()).toBeGreaterThanOrEqual(1);

      // The loading spinner is gone once results are shown
      await expect(page.locator(".loading-spinner")).not.toBeVisible();
    },
  );

  // ── Error handling ───────────────────────────────────────────────────────────

  test("submitting an empty input shows a browser validation or request error", async ({ page }) => {
    await page.getByRole("button", { name: "Audit" }).click();
    // The server returns a 400 which the client surfaces as an error message,
    // OR the browser's native required validation fires. Either is acceptable.
    // We just assert the spinner is not stuck.
    await expect(page.locator(".loading-spinner")).not.toBeVisible({ timeout: 10_000 });
  });
});
