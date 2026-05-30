// Exercises the real processAudit function with every external dependency
// (Postgres pool, Puppeteer, Lighthouse, Gemini) replaced via mock.module.
//
// Requires the --experimental-test-module-mocks flag (wired up in the
// "test" script in package.json). Node's module mocking is what lets us
// assert on processAudit's actual DB status transitions and browser cleanup
// rather than re-implementing the logic in the test.

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Resolve the exact specifiers auditProcessor.js imports so mock.module
// intercepts the same module URLs the processor will request.
const databaseUrl = import.meta.resolve("../config/database.js");
const extractUrl = import.meta.resolve("../utils/extractPageContext.js");

// ── Fixtures ────────────────────────────────────────────────────────────────

// A Lighthouse result complete enough for the happy path through processAudit.
function makeLhr() {
  return {
    categories: { performance: { score: 0.9 } },
    audits: {
      metrics: {
        details: {
          items: [
            {
              firstContentfulPaint: 1200,
              largestContentfulPaint: 2000,
              speedIndex: 1500,
              totalBlockingTime: 80,
            },
          ],
        },
      },
      "server-response-time": { numericValue: 300 },
      "total-byte-weight": { numericValue: 512000 },
      "cumulative-layout-shift": { numericValue: 0.05 },
      "unused-javascript": { details: { items: [] } },
      "resource-summary": { details: { items: [] } },
    },
  };
}

function makeJob({ attemptsMade = 0, attempts = 1 } = {}) {
  return {
    id: "job-1",
    data: { auditId: "audit-1", url: "https://example.com" },
    attemptsMade,
    opts: { attempts },
  };
}

// Records every query the processor runs so tests can assert on status transitions.
function makePoolMock({ queryImpl } = {}) {
  const calls = [];
  const query = mock.fn(async (text, params) => {
    calls.push({ text, params });
    if (queryImpl) return queryImpl(text, params);
    return { rows: [], rowCount: 0 };
  });
  return { pool: { query }, calls };
}

// Returns the status value set by the first UPDATE matching `WHERE id`.
function statusUpdates(calls) {
  return calls
    .filter((c) => /UPDATE audits SET status/.test(c.text))
    .map((c) => c.params[0]);
}

// ── Mock installation ─────────────────────────────────────────────────────────

let closeMock;

function installMocks({
  poolMock,
  launchThrows = false,
  lighthouseThrows = false,
  closeThrows = false,
} = {}) {
  closeMock = mock.fn(async () => {
    if (closeThrows) throw new Error("close failed");
  });

  const browser = {
    newPage: mock.fn(async () => ({ goto: mock.fn(async () => {}) })),
    wsEndpoint: mock.fn(() => "ws://127.0.0.1:9222/devtools/browser/abc"),
    close: closeMock,
  };

  mock.module("puppeteer", {
    defaultExport: {
      launch: mock.fn(async () => {
        if (launchThrows) throw new Error("chromium not found");
        return browser;
      }),
    },
  });

  mock.module("lighthouse", {
    defaultExport: mock.fn(async () => {
      if (lighthouseThrows) throw new Error("lighthouse failed");
      return { lhr: makeLhr() };
    }),
  });

  mock.module(databaseUrl, {
    defaultExport: poolMock.pool,
  });

  mock.module(extractUrl, {
    namedExports: { extractPageContext: async () => ({}) },
  });

  // Gemini always "fails" here so the deterministic rule-based fallback runs;
  // the AI happy path depends on a network call we don't want in unit tests.
  mock.module("@google/genai", {
    namedExports: {
      GoogleGenAI: class {
        constructor() {
          this.models = {
            generateContent: async () => {
              throw new Error("no API key in tests");
            },
          };
        }
      },
    },
  });
}

// Import a fresh copy of the processor after mocks are installed.
async function loadProcessor() {
  return import(`../processors/auditProcessor.js?t=${Date.now()}`);
}

// processAudit logs its progress and errors to the console on every path.
// Silence them during tests so the runner output stays readable; the
// assertions cover behavior, not log lines.
function silenceConsole() {
  mock.method(console, "log", () => {});
  mock.method(console, "warn", () => {});
  mock.method(console, "error", () => {});
}

describe("processAudit — failure paths", () => {
  beforeEach(() => {
    mock.restoreAll();
    silenceConsole();
  });

  afterEach(() => {
    mock.reset();
  });

  it("marks the audit failed on the last attempt when Lighthouse throws", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock, lighthouseThrows: true });
    const { processAudit } = await loadProcessor();

    await assert.rejects(
      () => processAudit(makeJob({ attemptsMade: 0, attempts: 1 })),
      /lighthouse failed/,
    );

    const statuses = statusUpdates(poolMock.calls);
    assert.deepEqual(
      statuses,
      ["running", "failed"],
      "should go running → failed when no retries remain",
    );
  });

  it("reverts the audit to pending when retries remain", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock, lighthouseThrows: true });
    const { processAudit } = await loadProcessor();

    await assert.rejects(
      () => processAudit(makeJob({ attemptsMade: 0, attempts: 3 })),
      /lighthouse failed/,
    );

    const statuses = statusUpdates(poolMock.calls);
    assert.deepEqual(
      statuses,
      ["running", "pending"],
      "should go running → pending while retries remain",
    );
  });

  it("marks failed on the final retry attempt (attemptsMade + 1 >= attempts)", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock, lighthouseThrows: true });
    const { processAudit } = await loadProcessor();

    await assert.rejects(
      () => processAudit(makeJob({ attemptsMade: 2, attempts: 3 })),
      /lighthouse failed/,
    );

    assert.deepEqual(statusUpdates(poolMock.calls), ["running", "failed"]);
  });

  it("closes the browser even when Lighthouse throws", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock, lighthouseThrows: true });
    const { processAudit } = await loadProcessor();

    await assert.rejects(() => processAudit(makeJob()), /lighthouse failed/);

    assert.equal(closeMock.mock.calls.length, 1, "browser.close must run in finally");
  });

  it("cleans up stale rows before re-running (DELETE precedes status update)", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock, lighthouseThrows: true });
    const { processAudit } = await loadProcessor();

    await assert.rejects(() => processAudit(makeJob()), /lighthouse failed/);

    const order = poolMock.calls.map((c) => c.text);
    const firstDelete = order.findIndex((t) => /DELETE FROM/.test(t));
    const firstRunning = order.findIndex(
      (t) => /UPDATE audits SET status/.test(t),
    );
    assert.ok(firstDelete !== -1, "expected cleanup DELETEs");
    assert.ok(
      firstDelete < firstRunning,
      "stale data must be deleted before status flips to running",
    );
  });

  it("propagates the error so BullMQ can retry", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock, launchThrows: true });
    const { processAudit } = await loadProcessor();

    await assert.rejects(() => processAudit(makeJob()), /chromium not found/);
  });

  it("surfaces a DB failure during status updates", async () => {
    // The very first query (cleanup DELETE) rejects — processAudit should
    // propagate it rather than silently completing.
    const poolMock = makePoolMock({
      queryImpl: () => {
        throw new Error("connection terminated");
      },
    });
    installMocks({ poolMock });
    const { processAudit } = await loadProcessor();

    await assert.rejects(() => processAudit(makeJob()), /connection terminated/);
  });
});

describe("processAudit — success path with fallback suggestions", () => {
  beforeEach(() => {
    mock.restoreAll();
    silenceConsole();
  });

  afterEach(() => {
    mock.reset();
  });

  it("completes the audit and writes rule-based suggestions when Gemini fails", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock }); // Gemini mock always throws → fallback path
    const { processAudit } = await loadProcessor();

    await processAudit(makeJob());

    const statuses = statusUpdates(poolMock.calls);
    assert.equal(statuses[0], "running");

    // Final completion is a separate UPDATE that also sets score + completed_at.
    const completed = poolMock.calls.find((c) =>
      /UPDATE audits SET status = \$1, score/.test(c.text),
    );
    assert.ok(completed, "expected a completion UPDATE");
    assert.equal(completed.params[0], "complete");
    assert.equal(completed.params[1], 90, "score should be round(0.9 * 100)");

    // At least one fallback suggestion should have been inserted.
    const inserts = poolMock.calls.filter((c) =>
      /INSERT INTO suggestions/.test(c.text),
    );
    assert.ok(inserts.length >= 1, "fallback should write at least one suggestion");
  });

  it("inserts metrics derived from the Lighthouse result", async () => {
    const poolMock = makePoolMock();
    installMocks({ poolMock });
    const { processAudit } = await loadProcessor();

    await processAudit(makeJob());

    const metricsInsert = poolMock.calls.find((c) =>
      /INSERT INTO metrics/.test(c.text),
    );
    assert.ok(metricsInsert, "expected a metrics INSERT");
    // params: [auditId, ttfb, fcp, lcp, bundleSize, ...]
    assert.equal(metricsInsert.params[1], 300); // ttfb
    assert.equal(metricsInsert.params[2], 1200); // fcp
    assert.equal(metricsInsert.params[3], 2000); // lcp
    assert.equal(metricsInsert.params[4], 500); // bundleSize 512000/1024
  });
});
