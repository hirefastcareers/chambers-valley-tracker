import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

function authorised(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = authHeader?.match(/^\s*Bearer\s+(\S+)\s*$/i)?.[1]?.trim();
  if (cronSecret && token === cronSecret) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  return Boolean(cronSecret && querySecret === cronSecret);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId query parameter required" }, { status: 400 });
  }

  const sql = getSql();

  await Promise.all([
    sql`UPDATE customers SET user_id = ${userId} WHERE user_id IS NULL`,
    sql`UPDATE jobs SET user_id = ${userId} WHERE user_id IS NULL`,
    sql`UPDATE follow_ups SET user_id = ${userId} WHERE user_id IS NULL`,
    sql`UPDATE recurring_reminders SET user_id = ${userId} WHERE user_id IS NULL`,
    sql`UPDATE quotes SET user_id = ${userId} WHERE user_id IS NULL`,
    sql`UPDATE dashboard_notes SET user_id = ${userId} WHERE user_id IS NULL`,
    sql`UPDATE settings SET user_id = ${userId} WHERE user_id IS NULL`,
    sql`UPDATE photos SET user_id = ${userId} WHERE user_id IS NULL`,
  ]);

  return NextResponse.json({
    ok: true,
    userId,
    message: "All rows with NULL user_id assigned to user",
  });
}
