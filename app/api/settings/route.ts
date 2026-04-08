import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const sql = getSql();
  const rows = await sql`
    SELECT key, value
    FROM settings
    WHERE key IN ('weekly_target', 'home_postcode');
  `;
  const rowMap = new Map((rows as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]));

  return NextResponse.json({
    ok: true,
    weekly_target: rowMap.get("weekly_target") ?? "350",
    home_postcode: rowMap.get("home_postcode") ?? "",
  });
}

export async function PUT(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const weeklyTarget = String(body.weekly_target ?? "").trim();
  const homePostcode = String(body.home_postcode ?? "").trim();

  if (weeklyTarget.length === 0 || Number.isNaN(Number(weeklyTarget))) {
    return NextResponse.json({ ok: false, error: "Invalid weekly target" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('weekly_target', ${weeklyTarget})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `;
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('home_postcode', ${homePostcode})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `;

  return NextResponse.json({ ok: true });
}

