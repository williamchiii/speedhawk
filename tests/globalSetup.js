// globalSetup.js — runs once before the entire Playwright suite.
//
// Responsibilities:
//   1. Start test Postgres + Redis via docker-compose.test.yml
//   2. Wait for both services to be healthy
//   3. Apply the DB schema (both migrations, in order)
//   4. Start the worker process in the background
//
// The server and Vite client are started by Playwright's webServer config
// so they are managed by Playwright itself (and get a fresh port check).

import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import pg from "pg";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Shared env that every service reads ──────────────────────────────────────

export const TEST_DB_URL =
  "postgresql://speedhawk_test:speedhawk_test@localhost:5433/speedhawk_test";
export const TEST_REDIS_HOST = "localhost";
export const TEST_REDIS_PORT = "6380";

// Build the env block once so globalSetup, webServer commands and the worker
// process all receive the exact same values.
export function buildTestEnv() {
  return {
    ...process.env,
    // Database
    DATABASE_URL: TEST_DB_URL,
    DATABASE_SSL: "false",
    // BullMQ Redis (local, no TLS, no password)
    REDIS_HOST: TEST_REDIS_HOST,
    REDIS_PORT: TEST_REDIS_PORT,
    REDIS_TLS: "false",
    UPSTASH_REDIS_REST_TOKEN: "",
    // Rate-limiter Upstash — point at the same local Redis via the
    // @upstash/redis REST-compatible ioredis shim if available, otherwise
    // the rate-limiter falls back to 503 which still lets the test pass.
    // Providing dummy values prevents Redis.fromEnv() from throwing at import.
    UPSTASH_REDIS_REST_URL: "http://localhost:6380",
    // Gemini — use the real key from the environment if present.
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    // Server
    PORT: "3001",
    CORS_ORIGIN: "http://localhost:5173",
    NODE_ENV: "test",
    // Client
    VITE_API_BASE_URL: "http://localhost:3001",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`[globalSetup] ${msg}\n`);
}

function composeCmd(subcommand) {
  return `docker compose -f ${path.join(__dirname, "docker-compose.test.yml")} ${subcommand}`;
}

async function waitForPostgres(retries = 30, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = new pg.Client({ connectionString: TEST_DB_URL });
      await client.connect();
      await client.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Timed out waiting for test Postgres to be ready");
}

async function applySchema(client) {
  const migrationsDir = path.join(ROOT, "server/internal/database/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // alphabetical = chronological given the timestamp prefix

  for (const file of files) {
    log(`Applying migration: ${file}`);
    const raw = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    // Extract only the content between "-- +goose Up" and the next
    // "-- +goose Down" (or end of file). Running the Down section would
    // immediately drop the tables we just created.
    const upMatch = raw.match(/-- \+goose Up\s*([\s\S]*?)(?=-- \+goose Down|$)/);
    if (!upMatch) {
      log(`No Up section found in ${file}, skipping`);
      continue;
    }
    const sql = upMatch[1].trim();
    if (sql) await client.query(sql);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function globalSetup() {
  // 1. Start infrastructure
  log("Starting Docker Compose services...");
  execSync(composeCmd("up -d --wait"), { stdio: "inherit" });

  // 2. Wait for Postgres TCP to accept connections (belt-and-suspenders over
  //    the Docker health check, since pg.Client gives us a clearer signal).
  log("Waiting for Postgres...");
  await waitForPostgres();

  // 3. Apply schema
  log("Applying database schema...");
  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();
  try {
    await applySchema(client);
  } finally {
    await client.end();
  }

  // 4. Start the worker as a background child process.
  //    Store the PID in a temp file so globalTeardown can kill it.
  log("Starting worker...");
  const env = buildTestEnv();
  const worker = spawn("node", ["src/worker.js"], {
    cwd: path.join(ROOT, "worker"),
    env,
    stdio: "inherit",
    detached: false,
  });

  worker.on("error", (err) => {
    process.stderr.write(`[globalSetup] Worker spawn error: ${err.message}\n`);
  });

  fs.writeFileSync(
    path.join(__dirname, ".worker.pid"),
    String(worker.pid),
    "utf8",
  );

  // Give the worker a moment to connect to Redis/DB before tests start.
  await new Promise((r) => setTimeout(r, 2000));

  log("All services ready.");
}
