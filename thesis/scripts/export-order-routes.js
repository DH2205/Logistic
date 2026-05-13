/**
 * Export order_ups routes (from_location -> to_location) to TXT file
 *
 * Requirements:
 * - Set SUPABASE_DB_URL or DATABASE_URL (Postgres connection string)
 *
 * Usage:
 *   node scripts/export-order-routes.js
 *   node scripts/export-order-routes.js --out order_routes.txt
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
require("dotenv").config();

const { Client } = require("pg");

function parseArgs(argv) {
  const args = {
    out: "order_routes.txt",
    schema: "public",
    table: "order_ups",
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) {
      args.out = argv[++i];
    } else if (a === "--schema" && argv[i + 1]) {
      args.schema = argv[++i];
    } else if (a === "--table" && argv[i + 1]) {
      args.table = argv[++i];
    }
  }

  return args;
}

async function connectPg(connectionString) {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  return client;
}

async function main() {
  const args = parseArgs(process.argv);
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Missing SUPABASE_DB_URL or DATABASE_URL (Postgres connection string). " +
        "Add it to .env.local or your environment."
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Connecting to database...`);
  const client = await connectPg(connectionString);

  try {
    // eslint-disable-next-line no-console
    console.log(`Querying ${args.schema}.${args.table}...`);

    const result = await client.query(
      `
      SELECT 
        id,
        order_id,
        from_location,
        to_location,
        status,
        created_at
      FROM ${args.schema}.${args.table}
      ORDER BY created_at DESC, id ASC
    `
    );

    const rows = result.rows;

    // eslint-disable-next-line no-console
    console.log(`Found ${rows.length} order route(s).`);

    const lines = [];
    lines.push("=== Order Routes (from order_ups table) ===");
    lines.push(`Exported at: ${new Date().toISOString()}`);
    lines.push(`Total routes: ${rows.length}`);
    lines.push("");
    lines.push("Format: id | order_id | from_location -> to_location | status | created_at");
    lines.push("".padEnd(80, "="));
    lines.push("");

    if (!rows.length) {
      lines.push("(no routes found in the table)");
    } else {
      for (const row of rows) {
        const fromLoc = row.from_location || "(unknown)";
        const toLoc = row.to_location || "(unknown)";
        const status = row.status || "(no status)";
        const createdAt = row.created_at
          ? new Date(row.created_at).toISOString().split("T")[0]
          : "(no date)";

        lines.push(
          `${row.id} | ${row.order_id} | ${fromLoc} -> ${toLoc} | ${status} | ${createdAt}`
        );
      }
    }

    lines.push("");
    lines.push("".padEnd(80, "="));
    lines.push("");
    lines.push("=== Unique Locations ===");
    const uniqueLocations = new Set();
    for (const row of rows) {
      if (row.from_location) uniqueLocations.add(row.from_location);
      if (row.to_location) uniqueLocations.add(row.to_location);
    }
    const sortedLocations = Array.from(uniqueLocations).sort();
    lines.push(`Total unique locations: ${sortedLocations.length}`);
    lines.push("");
    for (const loc of sortedLocations) {
      lines.push(`  - ${loc}`);
    }

    lines.push("");
    lines.push("".padEnd(80, "="));
    lines.push("");
    lines.push("=== Routes Summary (by order_id) ===");
    const orderMap = new Map();
    for (const row of rows) {
      if (!orderMap.has(row.order_id)) {
        orderMap.set(row.order_id, []);
      }
      orderMap.get(row.order_id).push(row);
    }
    lines.push(`Total unique orders: ${orderMap.size}`);
    lines.push("");

    for (const [orderId, routes] of orderMap) {
      lines.push(`Order: ${orderId} (${routes.length} route segment(s))`);
      for (const r of routes) {
        lines.push(`  ${r.from_location || "(unknown)"} -> ${r.to_location || "(unknown)"}`);
      }
      lines.push("");
    }

    const outPath = path.isAbsolute(args.out) ? args.out : path.resolve(process.cwd(), args.out);
    fs.writeFileSync(outPath, lines.join("\n"), "utf8");
    // eslint-disable-next-line no-console
    console.log(`✅ Wrote: ${outPath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exit(1);
});
