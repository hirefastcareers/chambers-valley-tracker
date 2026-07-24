import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

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
    INSERT INTO recurring_reminders (user_id, customer_id, job_type, interval_days, last_done_date, next_due_date, active)
    VALUES (
      ${userId},
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
