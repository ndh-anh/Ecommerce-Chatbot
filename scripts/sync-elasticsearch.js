// Recovery uses the same versioned outbox path as normal writes.
const { Client } = require("pg");
require("dotenv").config();
const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME || process.env.POSTGRES_USER,
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
  ssl:
    process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true },
});

async function run() {
  try {
    await client.connect();
    const products = await client.query(`
      SELECT id FROM products UNION SELECT product_id AS id FROM product_event_versions ORDER BY id
    `);
    for (const product of products.rows) {
      // One transaction per aggregate bounds locks and creates a new version.
      await client.query("SELECT enqueue_product_event($1::uuid)", [
        product.id,
      ]);
    }
    console.log(
      `Queued ${products.rowCount} versioned product snapshots/tombstones. API and Search Service must be running to deliver them.`,
    );
  } catch (error) {
    console.error("Could not enqueue search resynchronization:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
