import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getSql } from "@/lib/db";
import { upsertUserFromClerk } from "@/lib/user";

export const runtime = "nodejs";

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    "";

  if (email) {
    await upsertUserFromClerk(userId, email);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const businessName = String(body.business_name ?? "").trim();
  const tradeType = String(body.trade_type ?? "Gardening").trim();
  const homePostcode = String(body.home_postcode ?? "").trim().toUpperCase();
  const weeklyTarget = Number(body.weekly_target ?? 350);
  const onboardingCompleted = Boolean(body.onboarding_completed);

  if (onboardingCompleted) {
    if (!businessName) {
      return NextResponse.json({ ok: false, error: "Business name is required" }, { status: 400 });
    }
    if (!UK_POSTCODE.test(homePostcode)) {
      return NextResponse.json({ ok: false, error: "Invalid UK postcode" }, { status: 400 });
    }
    if (!Number.isFinite(weeklyTarget) || weeklyTarget <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid weekly target" }, { status: 400 });
    }
  }

  const sql = getSql();
  await sql`
    INSERT INTO users (
      id,
      email,
      business_name,
      trade_type,
      home_postcode,
      weekly_target,
      onboarding_completed
    )
    VALUES (
      ${userId},
      ${email || "unknown@example.com"},
      ${businessName || null},
      ${tradeType.toLowerCase()},
      ${homePostcode || null},
      ${Math.round(weeklyTarget)},
      ${onboardingCompleted}
    )
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email),
      business_name = COALESCE(EXCLUDED.business_name, users.business_name),
      trade_type = COALESCE(EXCLUDED.trade_type, users.trade_type),
      home_postcode = COALESCE(EXCLUDED.home_postcode, users.home_postcode),
      weekly_target = COALESCE(EXCLUDED.weekly_target, users.weekly_target),
      onboarding_completed = EXCLUDED.onboarding_completed;
  `;

  if (onboardingCompleted && homePostcode) {
    await sql`
      INSERT INTO settings (key, value, user_id)
      VALUES ('home_postcode', ${homePostcode}, ${userId})
      ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value;
    `;
    await sql`
      INSERT INTO settings (key, value, user_id)
      VALUES ('weekly_target', ${String(Math.round(weeklyTarget))}, ${userId})
      ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value;
    `;
  }

  return NextResponse.json({ ok: true });
}
