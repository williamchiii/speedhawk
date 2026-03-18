import { Queue } from "bullmq";
import logger from "../utils/logger.js";

const auditQueue = new Queue("audits", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.UPSTASH_REDIS_REST_TOKEN,
    tls: {},
  },
});

//log queue events
auditQueue.on("error", (err) => {
    logger.error(`Queue error: ${err}`);
});

logger.info("Audit Queue Initialized");

export default auditQueue;