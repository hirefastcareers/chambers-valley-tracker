import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  enumerateTaxWeeksMonSun,
  getJobQueryDateBounds,
  getMondayOfDate,
  getUkTaxYearBoundsYmdForDate,
  parseYmdLocal,
  toYmdLocal,
} from "@/lib/ukTaxYearWeeks";

export const runtime = "nodejs";

function moneyClose(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) <= tol;
}

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

type WeekJob = {
  id: number;
  customer_name: string;
  job_type: string;
  date_done: string;
  quote_amount: number;
};

export async function GET() {
  const authRes = await requireAuthApi();
  if (authRes) return authRes;

  const sql = getSql();
  const weeksTemplate = enumerateTaxWeeksMonSun();
  const { start: boundStart, end: boundEnd } = getJobQueryDateBounds();
  const tyBounds = getUkTaxYearBoundsYmdForDate(new Date());

  const jobRows = (await sql`
    SELECT
      j.id,
      c.name AS customer_name,
      j.job_type,
      j.date_done::date::text AS date_done,
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

  const windowTotalRow = (await sql`
    SELECT COALESCE(SUM(j.quote_amount), 0) AS total
    FROM jobs j
    WHERE j.status = 'completed'
      AND j.paid = true
      AND j.date_done IS NOT NULL
      AND j.date_done >= ${boundStart}::date
      AND j.date_done <= ${boundEnd}::date;
  `) as Array<{ total: string | number }>;

  const taxYearTotalRow = (await sql`
    SELECT COALESCE(SUM(j.quote_amount), 0) AS total
    FROM jobs j
    WHERE j.status = 'completed'
      AND j.paid = true
      AND j.date_done IS NOT NULL
      AND j.date_done >= ${tyBounds.start}::date
      AND j.date_done <= ${tyBounds.end}::date;
  `) as Array<{ total: string | number }>;

  const windowSqlTotal = Number(windowTotalRow[0]?.total ?? 0);
  const taxYearSqlTotal = Number(taxYearTotalRow[0]?.total ?? 0);

  const byWeek = new Map<string, WeekJob[]>();

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

  const weeksAsc = weeksTemplate.map((w) => {
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

  const weeklyWindowSum = weeksAsc.reduce((s, w) => s + w.total, 0);

  let taxYearWeeklySum = 0;
  for (const w of weeksAsc) {
    for (const j of w.jobs) {
      if (j.date_done >= tyBounds.start && j.date_done <= tyBounds.end) {
        taxYearWeeklySum += j.quote_amount;
      }
    }
  }

  const windowMatches = moneyClose(weeklyWindowSum, windowSqlTotal);
  const taxYearMatches = moneyClose(taxYearWeeklySum, taxYearSqlTotal);

  if (!windowMatches || !taxYearMatches) {
    console.warn("[earnings/weekly] reconciliation mismatch", {
      weeklyWindowSum,
      windowSqlTotal,
      windowMatches,
      taxYearWeeklySum,
      taxYearSqlTotal,
      taxYearMatches,
      tyBounds,
    });
  }

  return NextResponse.json({
    ok: true,
    weeks: weeksAsc,
    reconciliation: {
      windowWeeklySum: weeklyWindowSum,
      windowSqlTotal,
      windowMatches,
      taxYearWeeklySum,
      taxYearSqlTotal,
      taxYearMatches,
      taxYearStart: tyBounds.start,
      taxYearEnd: tyBounds.end,
    },
  });
}
