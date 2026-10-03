const fs = require("fs");
const path = require("path");
const db = require("./src/config/db");

const MIGRATIONS_DIR = path.join(__dirname, "src", "migrations");

async function main() {
  const file = process.argv[2] || "daily_insights.sql";
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
  await db.query(sql);
  console.log(`Migration applied: ${file}`);
  await db.pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
