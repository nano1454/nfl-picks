// Usage: node --env-file=.env scripts/run-sql.js path/to/file.sql
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node --env-file=.env scripts/run-sql.js <file.sql>");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), "utf8");

(async () => {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log(`✅ Ran ${file} successfully.`);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("❌ Failed:", e.message);
  process.exit(1);
});
