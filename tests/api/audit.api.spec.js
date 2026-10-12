// audit.api.spec.js — API-level E2E tests.
//
// These tests drive the full backend pipeline (server → BullMQ → worker →
// Postgres) through raw HTTP, with no browser. They validate the API contract
// and DB state transitions without rendering the React UI.

import { test, expect } from "@playwright/test";

const API = "http://localhost:3001";
const AUDIT_URL = "https://playwright.dev";

// Poll GET /api/audits/:id until the status leaves the in-progress states,
// or until the timeout is exceeded.
async function pollUntilDone(request, id, { timeoutMs = 150_000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`${API}/api/audits/${id}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    if (data.status === "complete" || data.status === "failed") {
      return data;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Audit ${id} did not finish within ${timeoutMs}ms`);
}

// ── Health check ──────────────────────────────────────────────────────────────

test("GET /health returns ok", async ({ request }) => {
  const res = await request.get(`${API}/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.service).toBe("server");
});

// ── Input validation ──────────────────────────────────────────────────────────

test("POST /api/audits rejects missing url with 400", async ({ request }) => {
  const res = await request.post(`${API}/api/audits`, {
    data: {},
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test("POST /api/audits rejects non-string url with 400", async ({ request }) => {
  const res = await request.post(`${API}/api/audits`, {
    data: { url: 12345 },
  });
  expect(res.status()).toBe(400);
});

test("POST /api/audits rejects clearly invalid url with 400", async ({ request }) => {
  const res = await request.post(`${API}/api/audits`, {
    data: { url: "not-a-url" },
  });
  expect(res.status()).toBe(400);
});

test("POST /api/audits rejects non-http protocol with 400", async ({ request }) => {
  const res = await request.post(`${API}/api/audits`, {
    data: { url: "ftp://example.com" },
  });
  expect(res.status()).toBe(400);
});

// ── Audit creation ────────────────────────────────────────────────────────────

test("POST /api/audits creates a pending audit and returns expected shape", async ({ request }) => {
  const res = await request.post(`${API}/api/audits`, {
    data: { url: AUDIT_URL },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();

  expect(body.success).toBe(true);
  expect(body.audit).toMatchObject({
    url: AUDIT_URL,
    status: "pending",
  });
  expect(typeof body.audit.id).toBe("number");
  expect(body.audit.created_at).toBeTruthy();
});

// ── Not found ─────────────────────────────────────────────────────────────────

test("GET /api/audits/:id returns 404 for unknown id", async ({ request }) => {
  const res = await request.get(`${API}/api/audits/999999`);
  expect(res.status()).toBe(404);
});

// ── Full pipeline ─────────────────────────────────────────────────────────────

test(
  "full pipeline: audit reaches complete with metrics and suggestions",
  async ({ request }) => {
    // 1. Submit the audit
    const createRes = await request.post(`${API}/api/audits`, {
      data: { url: AUDIT_URL },
    });
    expect(createRes.status()).toBe(201);
    const { audit } = await createRes.json();

    // 2. Poll until the worker finishes
    const result = await pollUntilDone(request, audit.id);

    // 3. Status must be complete (not failed)
    expect(result.status).toBe("complete");

    // 4. Score is a 0–100 integer
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    // 5. Metrics present with all expected Core Web Vital fields
    expect(result.metrics).not.toBeNull();
    expect(typeof result.metrics.ttfb).toBe("number");
    expect(typeof result.metrics.fcp).toBe("number");
    expect(typeof result.metrics.lcp).toBe("number");
    expect(typeof result.metrics.bundle_size).toBe("number");

    // 6. At least one suggestion with a valid schema
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);

    const VALID_TYPES = new Set(["performance", "bundle", "image", "rendering"]);
    const VALID_IMPACTS = new Set(["high", "medium", "low"]);

    for (const s of result.suggestions) {
      expect(VALID_TYPES.has(s.type)).toBe(true);
      expect(VALID_IMPACTS.has(s.impact)).toBe(true);
      expect(typeof s.message).toBe("string");
      expect(s.message.trim().length).toBeGreaterThan(0);
    }

    // 7. completed_at is set
    expect(result.completed_at).not.toBeNull();
  },
);

// ── URL normalisation ─────────────────────────────────────────────────────────

test("POST /api/audits normalises a bare domain by prepending https://", async ({ request }) => {
  // The server normalises "playwright.dev" → "https://playwright.dev"
  // and returns the normalised URL in the response — we just need the 201
  // and the correct stored URL, without running the full pipeline again.
  const res = await request.post(`${API}/api/audits`, {
    data: { url: "playwright.dev" },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.audit.url).toBe("https://playwright.dev");
});
