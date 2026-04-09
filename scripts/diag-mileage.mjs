/**
 * Run mileage diagnostics against Neon (uses DATABASE_URL from .env.local).
 * Usage: node --env-file=.env.local scripts/diag-mileage.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const content = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv();

const dbUrl =
  process.env.DATABASE_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

if (!dbUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(dbUrl);

async function main() {
  console.log("\n=== Jobs with mileage_miles IS NULL (all statuses) ===\n");
  const jobsNull = await sql`
    SELECT j.id, j.status, j.date_done, j.mileage_miles,
           c.name, c.distance_miles
    FROM jobs j
    JOIN customers c ON j.customer_id = c.id
    WHERE j.mileage_miles IS NULL
    ORDER BY c.name, j.date_done;
  `;
  console.table(jobsNull);

  console.log("\n=== Customers with NULL or zero distance_miles ===\n");
  const custBad = await sql`
    SELECT id, name, address, distance_miles
    FROM customers
    WHERE distance_miles IS NULL OR distance_miles = 0;
  `;
  console.table(custBad);

  console.log("\n=== Summary ===");
  console.log("jobs with null mileage:", jobsNull.length);
  console.log(
    "of those, customer has usable distance (>0):",
    jobsNull.filter((r) => {
      const d = Number(r.distance_miles);
      return Number.isFinite(d) && d > 0;
    }).length
  );
  console.log(
    "of those, customer missing/zero distance:",
    jobsNull.filter((r) => {
      const d = Number(r.distance_miles ?? NaN);
      return !Number.isFinite(d) || d <= 0;
    }).length
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
