import { Queue } from "bullmq";

// TLS is disabled when REDIS_TLS=false (e.g. local test Redis).
const redisTls = process.env.REDIS_TLS === "false" ? undefined : {};

const redisConnection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
  tls: redisTls,
};

export { redisConnection };