const fs = require("fs");
const path = require("path");
const db = require("./src/config/db");

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, "src", "migrations", "initial_schema.sql"),
    "utf8",
  );
  await db.query(sql);
  console.log("Database schema created successfully");
  await db.pool.end();
}

main().catch((err) => {
  console.error("Failed to create database schema:", err.message);
  process.exit(1);
});
