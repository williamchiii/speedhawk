import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust the relative path based on where your cert actually lives
const certPath = path.resolve(__dirname, "../../../shared/certs/global-bundle.pem");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync(certPath).toString(),
    rejectUnauthorized: true,
  },
  max: 10,
});

export default pool;
