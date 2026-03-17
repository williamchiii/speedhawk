import pg from "pg";
import logger from "../utils/logger.js";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", () => {
  logger.info("Connected to database (PostgreSQL)");
});

pool.on("error", (err) => {
  logger.critical(`Error connected to database (PostgreSQL) ${err}`);
  process.exit(1);
});

export async function testDatabase() {
  try {
    const result = await pool.query("SELECT NOW()");
    logger.info(`Database connected! Current time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    logger.critical("Error connecting to database:", error.message);
    return false;
  }
};

export default pool;