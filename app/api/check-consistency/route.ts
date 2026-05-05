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

type JobConsistencyRow = {
  id: number | string;
  status: string;
  paid: boolean;
  quote_amount: string | number | null;
  date_done: string | null;
  name: string;
  job_type: string | null;
};

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const sql = getSql();

  const [completedNotPaidRows, paidNotCompletedRows, totalEarnedRows, totalOutstandingRows] = await Promise.all([
    sql`
      SELECT j.id, j.status, j.paid, j.quote_amount, j.date_done, c.name, j.job_type
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      WHERE j.status = 'completed' AND j.paid = false
      ORDER BY j.date_done DESC NULLS LAST, j.created_at DESC;
    `,
    sql`
      SELECT j.id, j.status, j.paid, j.quote_amount, j.date_done, c.name, j.job_type
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      WHERE j.paid = true AND j.status != 'completed'
      ORDER BY j.date_done DESC NULLS LAST, j.created_at DESC;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE paid = true;
    `,
    sql`
      SELECT COALESCE(SUM(quote_amount), 0) AS total
      FROM jobs
      WHERE paid = false
        AND quote_amount IS NOT NULL
        AND quote_amount > 0;
    `,
  ]);

  const completedNotPaid = (completedNotPaidRows as JobConsistencyRow[]).map((r) => ({
    id: Number(r.id),
    status: r.status,
    paid: Boolean(r.paid),
    quote_amount: r.quote_amount === null ? null : Number(r.quote_amount),
    date_done: r.date_done ? String(r.date_done) : null,
    customer_name: r.name,
    job_type: r.job_type,
  }));

  const paidNotCompleted = (paidNotCompletedRows as JobConsistencyRow[]).map((r) => ({
    id: Number(r.id),
    status: r.status,
    paid: Boolean(r.paid),
    quote_amount: r.quote_amount === null ? null : Number(r.quote_amount),
    date_done: r.date_done ? String(r.date_done) : null,
    customer_name: r.name,
    job_type: r.job_type,
  }));

  const totalEarned = Number((totalEarnedRows as Array<{ total: string | number }>)[0]?.total ?? 0);
  const totalOutstanding = Number((totalOutstandingRows as Array<{ total: string | number }>)[0]?.total ?? 0);

  return NextResponse.json({
    completed_not_paid: completedNotPaid,
    paid_not_completed: paidNotCompleted,
    total_earned: totalEarned,
    total_outstanding: totalOutstanding,
  });
}
