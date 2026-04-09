/**
 * One-off E2E: login, create TEST_Mileage customers, verify distance_miles, migrate-mileage, delete.
 * Run with dev server: node scripts/e2e-mileage-test.mjs
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

const base = "http://localhost:3000";

const testCustomers = [
  {
    name: "TEST_Mileage Customer 1",
    address: "1 High Street, Sheffield, S1 2GH",
    phone: "07700000001",
    email: "test1@test.com",
  },
  {
    name: "TEST_Mileage Customer 2",
    address: "45 Fargate, Sheffield, S1 2HD",
    phone: "07700000002",
    email: "test2@test.com",
  },
  {
    name: "TEST_Mileage Customer 3",
    address: "100 Ecclesall Road, Sheffield, S11 8JB",
    phone: "07700000003",
    email: "test3@test.com",
  },
];

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.APP_PASSWORD }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login failed ${res.status}: ${t}`);
  }
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
  return cookieHeader;
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.NEON_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) throw new Error("Missing DATABASE_URL (or Neon equivalent)");

  const sql = neon(dbUrl);

  console.log("\n=== Settings: home_postcode ===");
  const homeRows = await sql`
    SELECT value FROM settings WHERE key = 'home_postcode' LIMIT 1;
  `;
  const homePostcode = homeRows[0]?.value ?? null;
  console.log("home_postcode:", homePostcode);

  console.log("\n=== Server-side GOOGLE_MAPS_API_KEY ===");
  console.log(
    "GOOGLE_MAPS_API_KEY set:",
    Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim())
  );

  const cookie = await login();
  console.log("\n=== Creating test customers ===");

  const createdIds = [];
  for (const body of testCustomers) {
    const res = await fetch(`${base}/api/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`${body.name}: HTTP ${res.status}`, data);
    if (data.customerId != null) createdIds.push(Number(data.customerId));
  }

  console.log("\n=== DB: SELECT id, name, address, distance_miles (TEST_Mileage%) ===");
  const rows = await sql`
    SELECT id, name, address, distance_miles
    FROM customers
    WHERE name LIKE ${"TEST_Mileage%"}
    ORDER BY id;
  `;
  console.table(rows);

  const allHaveDistance = rows.every(
    (r) => r.distance_miles != null && Number.isFinite(Number(r.distance_miles))
  );
  console.log("\nAll TEST_Mileage rows have distance_miles populated:", allHaveDistance);

  console.log("\n=== GET /api/migrate-mileage ===");
  const migRes = await fetch(`${base}/api/migrate-mileage`, { headers: { Cookie: cookie } });
  const migJson = await migRes.json().catch(() => ({}));
  console.log("migrate-mileage:", migRes.status, migJson);

  console.log("\n=== DELETE test customers ===");
  for (const id of createdIds) {
    const delRes = await fetch(`${base}/api/customers/${id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    const delJson = await delRes.json().catch(() => ({}));
    console.log(`DELETE /api/customers/${id}: HTTP ${delRes.status}`, delJson);
  }

  const remaining = await sql`
    SELECT id, name FROM customers WHERE name LIKE ${"TEST_Mileage%"} ORDER BY id;
  `;
  console.log("\n=== Remaining TEST_Mileage rows (should be empty) ===");
  console.log(remaining.length === 0 ? "(none)" : remaining);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
