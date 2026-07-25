import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { addDaysToYmd } from "@/lib/dashboardWeek";

export const runtime = "nodejs";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireUserIdApi();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const sql = getSql();

  type JobRow = {
    id: number | string;
    customer_id: number | string;
    job_type: string;
    description: string | null;
    quote_amount: string | number | null;
    time_of_day: "am" | "pm" | "all_day" | null;
    date_done: string | null;
    is_recurring: boolean | null;
    recurring_interval_weeks: number | string | null;
  };

  const existingRows = await sql`
    SELECT
      id,
      customer_id,
      job_type,
      description,
      quote_amount,
      time_of_day,
      date_done,
      is_recurring,
      recurring_interval_weeks
    FROM jobs
    WHERE id = ${idNum}
      AND user_id = ${userId}
    LIMIT 1;
  `;

  const existing = (existingRows as JobRow[])[0];
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const rows = await sql`
    UPDATE jobs
    SET
      paid = true,
      status = CASE
        WHEN status IN ('quoted', 'booked') THEN 'completed'
        ELSE status
      END
    WHERE id = ${idNum}
      AND user_id = ${userId}
    RETURNING id;
  `;

  if (!(rows as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  let nextJob: Record<string, unknown> | null = null;

  if (existing.is_recurring && existing.recurring_interval_weeks != null) {
    const intervalWeeks = Number(existing.recurring_interval_weeks);
    const dateDoneRaw = existing.date_done;
    if (Number.isFinite(intervalWeeks) && intervalWeeks > 0 && dateDoneRaw) {
      const dateStr = String(dateDoneRaw).includes("T") ? String(dateDoneRaw).split("T")[0]! : String(dateDoneRaw).slice(0, 10);
      const nextDate = addDaysToYmd(dateStr, intervalWeeks * 7);

      const insertRows = await sql`
        INSERT INTO jobs (
          user_id,
          customer_id,
          job_type,
          description,
          status,
          quote_amount,
          paid,
          date_done,
          time_of_day,
          is_recurring,
          recurring_interval_weeks,
          recurring_parent_id
        )
        VALUES (
          ${userId},
          ${Number(existing.customer_id)},
          ${existing.job_type},
          ${existing.description},
          'quoted',
          ${existing.quote_amount},
          false,
          ${nextDate}::date,
          ${existing.time_of_day ?? "all_day"},
          true,
          ${intervalWeeks},
          ${idNum}
        )
        RETURNING
          id,
          customer_id,
          job_type,
          description,
          status,
          quote_amount,
          paid,
          date_done,
          time_of_day,
          is_recurring,
          recurring_interval_weeks,
          recurring_parent_id;
      `;

      const created = (insertRows as Record<string, unknown>[])[0];
      if (created) {
        nextJob = {
          id: Number(created.id),
          customerId: Number(created.customer_id),
          jobType: created.job_type,
          description: created.description,
          status: created.status,
          quoteAmount: created.quote_amount,
          paid: Boolean(created.paid),
          dateDone: created.date_done,
          timeOfDay: created.time_of_day,
          isRecurring: Boolean(created.is_recurring),
          recurringIntervalWeeks: created.recurring_interval_weeks,
          recurringParentId: created.recurring_parent_id,
        };
      }
    }
  }

  return NextResponse.json({ ok: true, nextJob });
}
