import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { getUserById } from "@/lib/user";

export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const user = await getUserById(userId);
  const sql = getSql();
  const settingsRows = await sql`
    SELECT key, value
    FROM settings
    WHERE user_id = ${userId}
      AND key IN ('weekly_target', 'home_postcode');
  `;
  const rowMap = new Map((settingsRows as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]));

  return NextResponse.json({
    ok: true,
    weekly_target: String(user?.weekly_target ?? rowMap.get("weekly_target") ?? "350"),
    home_postcode: user?.home_postcode ?? rowMap.get("home_postcode") ?? "",
    business_name: user?.business_name ?? "",
    trade_type: user?.trade_type ?? "gardening",
    subscription_status: user?.subscription_status ?? "trialing",
    trial_ends_at: user?.trial_ends_at ?? null,
    stripe_customer_id: user?.stripe_customer_id ?? null,
  });
}

export async function PUT(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const weeklyTarget = String(body.weekly_target ?? "").trim();
  const homePostcode = String(body.home_postcode ?? "").trim();
  const businessName = String(body.business_name ?? "").trim();
  const tradeType = String(body.trade_type ?? "gardening").trim().toLowerCase();

  if (weeklyTarget.length === 0 || Number.isNaN(Number(weeklyTarget))) {
    return NextResponse.json({ ok: false, error: "Invalid weekly target" }, { status: 400 });
  }

  const weeklyTargetNum = Math.round(Number(weeklyTarget));
  const sql = getSql();

  await sql`
    UPDATE users
    SET
      home_postcode = ${homePostcode || null},
      weekly_target = ${weeklyTargetNum},
      business_name = ${businessName || null},
      trade_type = ${tradeType || "gardening"}
    WHERE id = ${userId};
  `;

  await sql`
    INSERT INTO settings (key, value, user_id)
    VALUES ('weekly_target', ${weeklyTarget}, ${userId})
    ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value;
  `;
  await sql`
    INSERT INTO settings (key, value, user_id)
    VALUES ('home_postcode', ${homePostcode}, ${userId})
    ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value;
  `;

  return NextResponse.json({ ok: true });
}
