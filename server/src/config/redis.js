import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import "dotenv/config";

//This is used for ratelimiting

// When Upstash credentials are absent (e.g. local test runs) we export null.
// The rate-limiter middleware already handles a missing/throwing limiter by
// returning 503, so the server stays functional without real credentials.
const hasUpstashCreds =
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = hasUpstashCreds ? Redis.fromEnv() : null;

//shared in-memory cache: once an IP is flagged over-limit, block it without a
//Redis round-trip. Cuts billable Upstash commands under a flood (we have a $20 cap).
const ephemeralCache = new Map();

// When redis is null the Ratelimit constructor still works but every .limit()
// call will throw — which the middleware catches and converts to a 503.
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
