import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

export default pool;
