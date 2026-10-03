const { Pool } = require("pg");
const path = require("path");

// Load .env from the backend folder regardless of the current working directory
// (so the server works whether you run `cd backend && npm run dev` or
// `node backend/server.js` from the repo root).
require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
  override: true,
});

if (!process.env.DATABASE_URL) {
  console.error(
    "Missing DATABASE_URL. Copy .env.example to .env and set your PostgreSQL connection string.",
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
