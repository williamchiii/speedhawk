import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import "dotenv/config";

//This is used for ratelimiting

//retrieve and export redis creds
export const redis = Redis.fromEnv();

//shared in-memory cache: once an IP is flagged over-limit, block it without a
//Redis round-trip. Cuts billable Upstash commands under a flood (we have a $20 cap).
const ephemeralCache = new Map();

export const strictRateLimit = new Ratelimit({
  redis,
  ephemeralCache,
  limiter: Ratelimit.slidingWindow(2, "30 s"), //2 per 30s
});
export const generousRateLimit = new Ratelimit({
  redis,
  ephemeralCache,
  limiter: Ratelimit.slidingWindow(60, "60 s"), //60 per 1 minute
});
