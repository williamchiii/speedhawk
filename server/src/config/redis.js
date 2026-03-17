import { Redis } from "@upstash/redis";
import logger from "../utils/logger.js"
import "dotenv/config"; 

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function testRedis() {
    try{
        logger.info("Testing Redis Connection");
        await redis.set('test-key', 'Test value');
        const value = await redis.get('test-key');
        logger.info(`"Got Value: ${value}`);
        logger.info("Redis connection successful!")
    } catch (error){
        logger.critical("Error connecting to Upstash Redis");
    }
};

testRedis();