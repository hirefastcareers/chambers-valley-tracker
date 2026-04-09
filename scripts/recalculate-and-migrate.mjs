/**
 * Authenticated: GET /api/recalculate-distances then GET /api/migrate-mileage.
 * Run with dev server: node scripts/recalculate-and-migrate.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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

async function login() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.APP_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed ${res.status}`);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const cookie = await login();

  const recRes = await fetch(`${base}/api/recalculate-distances?all=1`, {
    headers: { Cookie: cookie },
  });
  const recText = await recRes.text();
  let recJson;
  try {
    recJson = JSON.parse(recText);
  } catch {
    recJson = { _parseError: true, raw: recText };
  }
  console.log("GET /api/recalculate-distances:", recRes.status, recJson);

  const migRes = await fetch(`${base}/api/migrate-mileage?refresh=1`, {
    headers: { Cookie: cookie },
  });
  const migText = await migRes.text();
  let migJson;
  try {
    migJson = JSON.parse(migText);
  } catch {
    migJson = { _parseError: true, raw: migText };
  }
  console.log("GET /api/migrate-mileage:", migRes.status, migJson);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
