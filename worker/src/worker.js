import "dotenv/config";
import { Worker } from "bullmq";
import { redisConnection } from "./config/queue.js";
import {
  processAudit,
  markOrphanedAuditFailed,
  sweepStuckAudits,
} from "./processors/auditProcessor.js";

console.log("Starting Speedhawk Worker...");

const worker = new Worker("audits", processAudit, {
  connection: redisConnection,
  concurrency: 1, //process one job at a time
  limiter: {
    max: 10,
    duration: 6000, //max 10 jobs per 60 seconds
  },
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed \n`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);

  // Covers jobs BullMQ fails internally (e.g. stalled retries exhausted
  // after a crash), which skip processAudit's own catch block.
  if (job?.data?.auditId) {
    markOrphanedAuditFailed(job.data.auditId).catch((e) =>
      console.error(`Failed to mark orphaned audit ${job.data.auditId} as failed:`, e),
    );
  }
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

// Backstop: catches audits stuck 'running' if the queue never resolves the job.
const STUCK_AUDIT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  sweepStuckAudits().catch((e) => console.error("Stuck-audit sweep failed:", e));
}, STUCK_AUDIT_SWEEP_INTERVAL_MS);

console.log("Worker is running and waiting for jobs...\n");