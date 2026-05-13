/**
 * Supabase/Postgres schema graph -> Dijkstra shortest paths (unit weights) -> TXT output.
 *
 * Requirements:
 * - Set one of: SUPABASE_DB_URL or DATABASE_URL (Postgres connection string)
 *   Example: postgres://USER:PASSWORD@HOST:5432/postgres?sslmode=require
 *
 * Usage:
 *   node scripts/supabase-db-dijkstra.js
 *   node scripts/supabase-db-dijkstra.js --schema public --out db_dijkstra.txt
 *   node scripts/supabase-db-dijkstra.js --schemas public,auth --out out.txt
 */

const fs = require("fs");
const path = require("path");
const dns = require("dns");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
require("dotenv").config(); // fallback to .env / process env

const { Client } = require("pg");

function parseArgs(argv) {
  const args = {
    schemas: ["public"],
    out: "supabase_db_dijkstra.txt",
    includeSelf: false,
    direction: "undirected", // undirected | directed
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--schema" && argv[i + 1]) {
      args.schemas = [argv[++i]];
    } else if (a === "--schemas" && argv[i + 1]) {
      args.schemas = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--out" && argv[i + 1]) {
      args.out = argv[++i];
    } else if (a === "--include-self") {
      args.includeSelf = true;
    } else if (a === "--direction" && argv[i + 1]) {
      args.direction = argv[++i];
    }
  }

  if (args.direction !== "undirected" && args.direction !== "directed") {
    throw new Error(`--direction must be 'undirected' or 'directed' (got '${args.direction}')`);
  }
  if (!args.schemas.length) args.schemas = ["public"];
  return args;
}

function qname(schema, name) {
  return `${schema}.${name}`;
}

/**
 * Dijkstra on an adjacency list with unit weights.
 * @param {Map<string, Set<string>>} adj
 * @param {string} source
 * @returns {{dist: Map<string, number>, prev: Map<string, string|null>}}
 */
function dijkstraUnit(adj, source) {
  // For unit weights, a BFS would be optimal; we keep the Dijkstra interface.
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  const queue = [];

  for (const node of adj.keys()) {
    dist.set(node, Infinity);
    prev.set(node, null);
  }
  dist.set(source, 0);
  queue.push(source);

  while (queue.length) {
    const u = queue.shift();
    if (visited.has(u)) continue;
    visited.add(u);

    const neighbors = adj.get(u);
    if (!neighbors) continue;
    for (const v of neighbors) {
      const alt = dist.get(u) + 1;
      if (alt < dist.get(v)) {
        dist.set(v, alt);
        prev.set(v, u);
        queue.push(v);
      }
    }
  }

  return { dist, prev };
}

function reconstructPath(prev, target) {
  const out = [];
  let cur = target;
  while (cur) {
    out.push(cur);
    cur = prev.get(cur);
  }
  out.reverse();
  return out;
}

function shouldUseSsl(connectionString) {
  try {
    const u = new URL(connectionString);
    return (u.searchParams.get("sslmode") || "").toLowerCase() === "require";
  } catch {
    return connectionString.includes("sslmode=require");
  }
}

function redactedConnStringForLogs(connectionString) {
  try {
    const u = new URL(connectionString);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(unparseable connection string)";
  }
}

function applyHostOverride(connectionString) {
  const overrideHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;
  if (!overrideHost) return connectionString;
  const u = new URL(connectionString);
  u.hostname = overrideHost;
  return u.toString();
}

async function connectPgWithDnsFallback(connectionString) {
  connectionString = applyHostOverride(connectionString);
  const ssl = shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined;

  // Always resolve host using public DNS to avoid getaddrinfo ENOENT on some Windows setups
  let u;
  try {
    u = new URL(connectionString);
  } catch (e) {
    throw new Error(
      `DB host could not be resolved and connection string is not a valid URL. Connection: ${redactedConnStringForLogs(
        connectionString
      )}`
    );
  }

  const originalHost = u.hostname;
  const port = Number(u.port || "5432");
  const database = (u.pathname || "/postgres").replace(/^\//, "") || "postgres";
  const user = decodeURIComponent(u.username || "");
  const password = decodeURIComponent(u.password || "");

  // If DNS is blocked / unreliable, allow manual override with an IP from `nslookup`.
  const manualIp = process.env.SUPABASE_DB_HOST_IP || process.env.DB_HOST_IP;
  const manualHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST;

  let resolvedHost = originalHost;

  if (manualIp) {
    // eslint-disable-next-line no-console
    console.log(`Using SUPABASE_DB_HOST_IP/DB_HOST_IP override: ${manualIp}`);
    if (manualIp.includes(":")) {
      throw new Error(
        "SUPABASE_DB_HOST_IP is set to an IPv6 address, but your network cannot reach IPv6 (ENETUNREACH). " +
          "Remove SUPABASE_DB_HOST_IP (or set it to an IPv4 address), OR switch to Supabase Pooler host (recommended)."
      );
    }
    resolvedHost = manualIp;
  } else if (manualHost) {
    // eslint-disable-next-line no-console
    console.log(`Using SUPABASE_DB_HOST/DB_HOST override: ${manualHost}`);
    resolvedHost = manualHost;
  } else {
    // Pre-resolve DNS using public resolvers to avoid getaddrinfo ENOENT on some Windows setups
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
    let address;
    try {
      // Try IPv4 first (family: 4)
      ({ address } = await dns.promises.lookup(originalHost, { family: 4, all: false }));
      // eslint-disable-next-line no-console
      console.log(`Resolved ${originalHost} -> ${address} (IPv4)`);
    } catch (err4) {
      try {
        // Fallback to IPv6
        ({ address } = await dns.promises.lookup(originalHost, { family: 6, all: false }));
        // eslint-disable-next-line no-console
        console.log(`Resolved ${originalHost} -> ${address} (IPv6)`);
      } catch (err6) {
        // eslint-disable-next-line no-console
        console.error(`DNS resolution failed for ${originalHost}. Consider setting SUPABASE_DB_HOST to Pooler hostname.`);
        throw err6;
      }
    }
    resolvedHost = address;
  }

  const client = new Client({
    host: resolvedHost,
    port,
    database,
    user,
    password,
    ssl: ssl ? { ...ssl, servername: originalHost } : undefined,
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    if (err.code === "ENETUNREACH" && resolvedHost.includes(":")) {
      // eslint-disable-next-line no-console
      console.error(
        `Cannot reach IPv6 address ${resolvedHost}. Your network likely doesn't support IPv6. ` +
          `Recommendation: use Supabase Pooler connection string (often has IPv4 support).`
      );
    }
    throw err;
  }
}

async function loadSchemaGraph({ connectionString, schemas, direction }) {
  const client = await connectPgWithDnsFallback(connectionString);

  try {
    // Tables
    const tablesRes = await client.query(
      `
      select table_schema, table_name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema = any($1::text[])
      order by table_schema, table_name
    `,
      [schemas]
    );

    const tables = tablesRes.rows.map((r) => qname(r.table_schema, r.table_name));
    const tableSet = new Set(tables);

    // Foreign keys: (from_table) -> (to_table)
    const fksRes = await client.query(
      `
      select
        tc.table_schema as from_schema,
        tc.table_name as from_table,
        ccu.table_schema as to_schema,
        ccu.table_name as to_table,
        tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = any($1::text[])
        and ccu.table_schema = any($1::text[])
      order by from_schema, from_table, to_schema, to_table, constraint_name
    `,
      [schemas]
    );

    /** @type {Map<string, Set<string>>} */
    const adj = new Map();
    for (const t of tables) adj.set(t, new Set());

    const edges = [];
    for (const r of fksRes.rows) {
      const from = qname(r.from_schema, r.from_table);
      const to = qname(r.to_schema, r.to_table);
      if (!tableSet.has(from) || !tableSet.has(to)) continue;

      edges.push({ from, to, constraint: r.constraint_name });
      adj.get(from).add(to);
      if (direction === "undirected") {
        adj.get(to).add(from);
      }
    }

    return { tables, edges, adj };
  } finally {
    await client.end();
  }
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

  const { tables, edges, adj } = await loadSchemaGraph({
    connectionString,
    schemas: args.schemas,
    direction: args.direction,
  });

  const lines = [];
  lines.push("Supabase DB Dijkstra Paths (tables graph)");
  lines.push(`Schemas: ${args.schemas.join(", ")}`);
  lines.push(`Direction: ${args.direction}`);
  lines.push(`Tables: ${tables.length}`);
  lines.push(`FK edges: ${edges.length}`);
  lines.push("");
  lines.push("=== Edges (FK relationships) ===");
  if (!edges.length) {
    lines.push("(no foreign keys found in the selected schema(s))");
  } else {
    for (const e of edges) {
      lines.push(`${e.from} -> ${e.to}  [${e.constraint}]`);
    }
  }
  lines.push("");
  lines.push("=== Shortest paths (unit weight) ===");

  const sortedTables = [...tables].sort((a, b) => a.localeCompare(b));
  for (const src of sortedTables) {
    lines.push("");
    lines.push(`-- From: ${src}`);

    const { dist, prev } = dijkstraUnit(adj, src);
    const dests = [...sortedTables].filter((d) => (args.includeSelf ? true : d !== src));

    for (const dst of dests) {
      const d = dist.get(dst);
      if (!Number.isFinite(d) || d === Infinity) {
        lines.push(`${dst}: (unreachable)`);
        continue;
      }
      const pathNodes = reconstructPath(prev, dst);
      lines.push(`${dst}: ${pathNodes.join(" -> ")} (hops=${d})`);
    }
  }

  const outPath = path.isAbsolute(args.out) ? args.out : path.resolve(process.cwd(), args.out);
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote: ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exit(1);
});

