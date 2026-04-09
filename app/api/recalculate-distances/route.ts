import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { calculateDrivingMiles } from "@/lib/distance";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function recalculate() {
  const sql = getSql();

  const settingsRows = await sql`
    SELECT value
    FROM settings
    WHERE key = 'home_postcode'
    LIMIT 1;
  `;
  const homePostcode = String((settingsRows as Array<{ value: string }>)[0]?.value ?? "");

  const rows = await sql`
    SELECT id, address
    FROM customers
    WHERE address IS NOT NULL
      AND TRIM(address) <> ''
      AND distance_miles IS NULL;
  `;

  const list = rows as Array<{ id: number | string; address: string }>;
  let updated = 0;
  let skipped = 0;

  for (const row of list) {
    const idNum = typeof row.id === "bigint" ? Number(row.id) : Number(row.id);
    const miles = await calculateDrivingMiles(homePostcode, row.address);
    if (miles === null) {
      skipped += 1;
      continue;
    }
    await sql`
      UPDATE customers
      SET distance_miles = ${miles}
      WHERE id = ${idNum};
    `;
    updated += 1;
  }

  return { ok: true as const, updated, skipped, total: list.length };
}

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;
  return NextResponse.json(await recalculate());
}

export async function POST() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;
  return NextResponse.json(await recalculate());
}
