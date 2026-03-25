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

export async function POST(req: Request) {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const customerId = Number(body.customerId);
  const jobType = typeof body.jobType === "string" ? body.jobType : "";
  const intervalDays = Number(body.intervalDays);

  if (!Number.isFinite(customerId) || !jobType || !Number.isFinite(intervalDays) || intervalDays <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO recurring_reminders (customer_id, job_type, interval_days, last_done_date, next_due_date, active)
    VALUES (
      ${customerId},
      ${jobType},
      ${Math.floor(intervalDays)},
      NULL,
      (current_date + (${Math.floor(intervalDays)}::text || ' days')::interval)::date,
      true
    )
    RETURNING id;
  `;

  type InsertRow = { id: number | string };
  const rowsTyped = rows as InsertRow[];
  return NextResponse.json({ ok: true, reminderId: Number(rowsTyped[0].id) });
}

