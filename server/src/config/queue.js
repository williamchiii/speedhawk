import { Queue } from "bullmq";
import logger from "../utils/logger.js";

// TLS is disabled when REDIS_TLS=false (e.g. local test Redis).
const redisTls = process.env.REDIS_TLS === "false" ? undefined : {};

const auditQueue = new Queue("audits", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.UPSTASH_REDIS_REST_TOKEN,
    tls: redisTls,
  },
});

//log queue events
auditQueue.on("error", (err) => {
    logger.error(`Queue error: ${err}`);
});

logger.info("Audit Queue Initialized");

export default auditQueue;