// globalTeardown.js — runs once after the entire Playwright suite.
//
// Responsibilities:
//   1. Kill the worker process started by globalSetup
//   2. Tear down Docker Compose (Postgres + Redis)

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(msg) {
  process.stdout.write(`[globalTeardown] ${msg}\n`);
}

function composeCmd(subcommand) {
  return `docker compose -f ${path.join(__dirname, "docker-compose.test.yml")} ${subcommand}`;
}

export default async function globalTeardown() {
  // 1. Kill the worker
  const pidFile = path.join(__dirname, ".worker.pid");
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
    try {
      process.kill(pid, "SIGTERM");
      log(`Sent SIGTERM to worker (pid ${pid})`);
    } catch {
      // Process may have already exited — not an error.
    }
    fs.unlinkSync(pidFile);
  }

  // 2. Stop and remove Docker Compose services + volumes
  log("Stopping Docker Compose services...");
  try {
    execSync(composeCmd("down -v"), { stdio: "inherit" });
  } catch (err) {
    process.stderr.write(`[globalTeardown] docker compose down failed: ${err.message}\n`);
  }

  log("Teardown complete.");
}
