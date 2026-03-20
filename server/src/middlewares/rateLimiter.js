import { strictRateLimit, generousRateLimit } from "../config/redis.js";
import logger from "../utils/logger.js";

const createRateLimiter = (limiterInstance) => {
  return async (req, res, next) => {
    try {
      //each ip has its own rate limit, in future date have ip or user depending on login or not
      const ip = req.ip;
      const { success } = await limiterInstance.limit(ip);
      if (!success) {
        logger.error(`rate limiting hit`);
        return res
          .status(429)
          .json({ error: "Too many requests. Please try again later." });
      }
      //if under the rate limit continue to next middleware
      next();
    } catch (error) {
      logger.error("rate limit error");
      //pass error to Express's global error handler
      next(error);
    }
  };
};

export const strictRateLimiter = createRateLimiter(strictRateLimit);
export const generousRateLimiter = createRateLimiter(generousRateLimit);
