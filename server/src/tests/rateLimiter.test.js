import { describe, it, expect, vi } from "vitest";

vi.mock("../config/redis.js", () => ({
  strictRateLimit: { limit: vi.fn() },
  generousRateLimit: { limit: vi.fn() },
}));
vi.mock("../utils/logger.js", () => ({
  default: { error: vi.fn() },
}));

import { strictRateLimiter } from "../middlewares/rateLimiter.js";
import { strictRateLimit } from "../config/redis.js";

describe("rateLimiter", () => {
  const req = { ip: "127.0.0.1" };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

  it("allows when under limit", async () => {
    strictRateLimit.limit.mockResolvedValue({ success: true });
    const next = vi.fn();
    await strictRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("blocks with 429 when over limit", async () => {
    strictRateLimit.limit.mockResolvedValue({ success: false });
    const next = vi.fn();
    await strictRateLimiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
