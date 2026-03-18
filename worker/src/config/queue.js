import { Queue } from "bullmq";

const redisConnection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
};

export { redisConnection };