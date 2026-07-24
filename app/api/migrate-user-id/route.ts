import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || null;
}

function authorised(request: Request): { ok: true } | { ok: false; error: string } {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return { ok: false, error: "CRON_SECRET is not configured on the server" };
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const bearerToken = authHeader?.match(/^\s*Bearer\s+(\S+)\s*$/i)?.[1]?.trim();
  if (bearerToken === cronSecret) {
    return { ok: true };
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  if (querySecret === cronSecret) {
    return { ok: true };
  }

  return { ok: false, error: "Unauthorised" };
}

export async function GET(request: Request) {
  const auth = authorised(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.error.includes("CRON_SECRET") ? 500 : 401 }
    );
  }

  const url = new URL(request.url);
  const fromUserId = url.searchParams.get("fromUserId")?.trim();
  const toUserId = url.searchParams.get("toUserId")?.trim();

  if (!fromUserId || !toUserId) {
    return NextResponse.json(
      { ok: false, error: "fromUserId and toUserId query parameters are required" },
      { status: 400 }
    );
  }

  if (fromUserId === toUserId) {
    return NextResponse.json(
      { ok: false, error: "fromUserId and toUserId must be different" },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();
    const updated: Record<string, number> = {};

    const customers = await sql`
      UPDATE customers SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING id
    `;
    updated.customers = (customers as unknown[]).length;

    const jobs = await sql`
      UPDATE jobs SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING id
    `;
    updated.jobs = (jobs as unknown[]).length;

    const followUps = await sql`
      UPDATE follow_ups SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING id
    `;
    updated.follow_ups = (followUps as unknown[]).length;

    const recurringReminders = await sql`
      UPDATE recurring_reminders SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING id
    `;
    updated.recurring_reminders = (recurringReminders as unknown[]).length;

    const quotes = await sql`
      UPDATE quotes SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING id
    `;
    updated.quotes = (quotes as unknown[]).length;

    const dashboardNotes = await sql`
      UPDATE dashboard_notes SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING id
    `;
    updated.dashboard_notes = (dashboardNotes as unknown[]).length;

    const settings = await sql`
      UPDATE settings SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING key
    `;
    updated.settings = (settings as unknown[]).length;

    const photos = await sql`
      UPDATE photos SET user_id = ${toUserId} WHERE user_id = ${fromUserId} RETURNING id
    `;
    updated.photos = (photos as unknown[]).length;

    const users = await sql`
      UPDATE users SET id = ${toUserId} WHERE id = ${fromUserId} RETURNING id
    `;
    updated.users = (users as unknown[]).length;

    const totalUpdated = Object.values(updated).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      ok: true,
      fromUserId,
      toUserId,
      totalUpdated,
      updated,
    });
  } catch (error) {
    console.error("[migrate-user-id] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
