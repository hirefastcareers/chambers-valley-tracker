/**
 * One-off diagnostic: customers missing lat/lng and why geocode may have failed.
 * Usage: node scripts/report-geocode-skipped.cjs
 * Loads .env.local from repo root (DATABASE_URL*, NEXT_PUBLIC_GOOGLE_PLACES_API_KEY).
 */
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) {
    console.warn("No .env.local found at", p);
    return;
  }
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function databaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.NEON_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null
  );
}

async function main() {
  loadEnvLocal();
  const url = databaseUrl();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!url) {
    console.error("Missing database URL (DATABASE_URL, NEON_DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING)");
    process.exit(1);
  }
  if (!apiKey) {
    console.error("Missing NEXT_PUBLIC_GOOGLE_PLACES_API_KEY — cannot probe Google Geocoding responses.");
    process.exit(1);
  }

  const sql = neon(url);
  const rows = await sql`
    SELECT id, name, address, latitude, longitude
    FROM customers
    WHERE latitude IS NULL OR longitude IS NULL
    ORDER BY name;
  `;

  console.log("\n=== Customers with NULL latitude or longitude ===\n");
  console.log(JSON.stringify(rows, null, 2));

  const emptyAddress = [];
  const needsProbe = [];

  for (const r of rows) {
    const addr = r.address == null ? "" : String(r.address).trim();
    if (!addr) {
      emptyAddress.push(r);
    } else {
      needsProbe.push(r);
    }
  }

  console.log("\n--- Expected skips (empty / null address) ---");
  if (emptyAddress.length === 0) {
    console.log("(none)");
  } else {
    for (const r of emptyAddress) {
      console.log(`id=${r.id} name="${r.name}" address=<empty or null>`);
    }
  }

  console.log("\n--- Addresses present but still missing coordinates (Google API response) ---");
  if (needsProbe.length === 0) {
    console.log("(none — all missing coords are explained by empty addresses, or no rows)");
  }

  for (const r of needsProbe) {
    const addr = String(r.address).trim();
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${apiKey}`;
    const res = await fetch(geocodeUrl);
    const bodyText = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = { _parseError: true, raw: bodyText.slice(0, 2000) };
    }
    console.log(`\nid=${r.id} name="${r.name}"`);
    console.log(`address="${addr}"`);
    console.log("Google Geocoding API response:");
    console.log(JSON.stringify(parsed, null, 2));
  }

  console.log("\n=== Done ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
