import "dotenv/config";
import { Worker } from "bullmq";
import { redisConnection } from "./config/queue.js";
import { processAudit } from "./processors/auditProcessor.js";

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
});

worker.on("error", (err) => {
    console.error("Worker error:", err);
});

console.log("Worker is running and waiting for jobs...\n");