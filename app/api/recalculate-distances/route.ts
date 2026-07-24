import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { calculateDrivingMiles } from "@/lib/distance";

export const runtime = "nodejs";

async function getHomePostcode(sql: ReturnType<typeof getSql>, userId: string): Promise<string> {
  const userRows = await sql`
    SELECT home_postcode
    FROM users
    WHERE id = ${userId}
    LIMIT 1;
  `;
  let homePostcode = String((userRows as Array<{ home_postcode: string | null }>)[0]?.home_postcode ?? "");
  if (!homePostcode) {
    const settingsRows = await sql`
      SELECT value
      FROM settings
      WHERE key = 'home_postcode'
        AND user_id = ${userId}
      LIMIT 1;
    `;
    homePostcode = String((settingsRows as Array<{ value: string }>)[0]?.value ?? "");
  }
  return homePostcode;
}

async function recalculate(userId: string, recalculateAll: boolean) {
  const sql = getSql();
  const homePostcode = await getHomePostcode(sql, userId);

  const rows = recalculateAll
    ? await sql`
        SELECT id, address
        FROM customers
        WHERE user_id = ${userId}
          AND address IS NOT NULL
          AND TRIM(address) <> '';
      `
    : await sql`
        SELECT id, address
        FROM customers
        WHERE user_id = ${userId}
          AND address IS NOT NULL
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
      WHERE id = ${idNum}
        AND user_id = ${userId};
    `;
    updated += 1;
  }

  return {
    ok: true as const,
    updated,
    skipped,
    total: list.length,
    recalculateAll: recalculateAll,
  };
}

function wantsRecalculateAll(req: Request): boolean {
  const url = new URL(req.url);
  return (
    url.searchParams.get("all") === "1" ||
    url.searchParams.get("force") === "1"
  );
}

export async function GET(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  return NextResponse.json(await recalculate(authResult.userId, wantsRecalculateAll(req)));
}

export async function POST(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const body = await req.json().catch(() => null) as { all?: boolean; force?: boolean } | null;
  const fromBody = Boolean(body?.all === true || body?.force === true);
  const recalculateAll = fromBody || wantsRecalculateAll(req);
  return NextResponse.json(await recalculate(authResult.userId, recalculateAll));
}
