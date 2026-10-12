import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";
import "dotenv/config";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSL is disabled when DATABASE_SSL=false (e.g. local test Postgres).
// Otherwise the AWS RDS bundle is required.
const sslDisabled = process.env.DATABASE_SSL === "false";
const certPath = path.resolve(__dirname, "../../../shared/certs/global-bundle.pem");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslDisabled
    ? false
    : {
        ca: fs.readFileSync(certPath).toString(),
        rejectUnauthorized: true,
      },
  max: 10,
});

export async function testDatabase() {
  try {
    const result = await pool.query("SELECT NOW()");
    logger.info(`Database connected! Current time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    logger.critical(`Error connecting to database: ${error.message}`);
    console.error("Full error:", error);
    return false;
  }
}

export default pool;