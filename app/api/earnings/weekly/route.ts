import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  enumerateTaxWeeksMonSun,
  getJobQueryDateBounds,
  getMondayOfDate,
  parseYmdLocal,
  toYmdLocal,
} from "@/lib/ukTaxYearWeeks";

export const runtime = "nodejs";

async function requireAuthApi() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get(AUTH_COOKIE)?.value);
  if (!hasAuth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type JobRow = {
  id: number | string;
  customer_name: string;
  job_type: string;
  date_done: string;
  quote_amount: string | number | null;
};

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const sql = getSql();
  const weeksTemplate = enumerateTaxWeeksMonSun();
  const { start: boundStart, end: boundEnd } = getJobQueryDateBounds();

  const jobRows = (await sql`
    SELECT
      j.id,
      c.name AS customer_name,
      j.job_type,
      j.date_done::text AS date_done,
      j.quote_amount
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    WHERE j.status = 'completed'
      AND j.paid = true
      AND j.date_done IS NOT NULL
      AND j.date_done >= ${boundStart}::date
      AND j.date_done <= ${boundEnd}::date
    ORDER BY j.date_done DESC, j.id DESC;
  `) as JobRow[];

  const byWeek = new Map<
    string,
    Array<{
      id: number;
      customer_name: string;
      job_type: string;
      date_done: string;
      quote_amount: number;
    }>
  >();

  for (const w of weeksTemplate) {
    byWeek.set(w.week_start, []);
  }

  for (const r of jobRows) {
    const part = String(r.date_done).split("T")[0] ?? "";
    const done = parseYmdLocal(part);
    const mon = getMondayOfDate(done);
    const key = toYmdLocal(mon);
    const bucket = byWeek.get(key);
    if (!bucket) continue;
    bucket.push({
      id: Number(r.id),
      customer_name: r.customer_name,
      job_type: r.job_type,
      date_done: part,
      quote_amount: Number(r.quote_amount ?? 0),
    });
  }

  const weeksDesc = [...weeksTemplate].reverse().map((w) => {
    const jobs = [...(byWeek.get(w.week_start) ?? [])].sort((a, b) => {
      if (a.date_done !== b.date_done) return b.date_done.localeCompare(a.date_done);
      return b.id - a.id;
    });
    const total = jobs.reduce((s, j) => s + j.quote_amount, 0);
    return {
      week_start: w.week_start,
      week_end: w.week_end,
      total,
      jobs,
    };
  });

  return NextResponse.json({ ok: true, weeks: weeksDesc });
}
