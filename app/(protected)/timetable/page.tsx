import { auth } from "@clerk/nextjs/server";
import WeeklyTimetable, { type TimetableJob } from "@/components/WeeklyTimetable";
import {
  addDaysToYmd,
  calendarYmdFromDbDate,
  getCurrentWeekBounds,
  normalizeCalendarYmd,
} from "@/lib/dashboardWeek";
import { getSql } from "@/lib/db";
import type { JobStatus } from "@/lib/status";

function londonCalendarYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return "";
  return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function mondayOfYmd(ymd: string): string {
  const normalized = normalizeCalendarYmd(ymd);
  if (!normalized) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!m) return "";
  const sun0 = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  const daysFromMonday = sun0 === 0 ? 6 : sun0 - 1;
  return addDaysToYmd(normalized, -daysFromMonday);
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const params = await searchParams;
  const weekRaw = Array.isArray(params.week) ? params.week[0] : params.week;
  const londonTodayYmd = londonCalendarYmd(new Date());
  const requestedMonday = weekRaw ? mondayOfYmd(weekRaw) : "";
  const weekMonday =
    requestedMonday || getCurrentWeekBounds(londonTodayYmd).monday;
  const weekSunday = addDaysToYmd(weekMonday, 6);

  type JobRow = {
    job_id: number | string;
    customer_id: number | string;
    customer_name: string;
    job_type: string;
    status: JobStatus;
    quote_amount: string | number | null;
    date_done: string;
    time_of_day: "am" | "pm" | "all_day" | null;
  };

  let rows: JobRow[] = [];
  try {
    const sql = getSql();
    rows = (await sql`
      SELECT
        j.id AS job_id,
        c.id AS customer_id,
        c.name AS customer_name,
        j.job_type,
        j.status,
        j.quote_amount,
        j.date_done::text AS date_done,
        j.time_of_day
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      WHERE j.user_id = ${userId}
        AND c.user_id = ${userId}
        AND j.date_done IS NOT NULL
        AND j.date_done::date >= ${weekMonday}::date
        AND j.date_done::date <= ${weekSunday}::date
      ORDER BY
        j.date_done::date ASC,
        CASE j.time_of_day
          WHEN 'am' THEN 1
          WHEN 'all_day' THEN 2
          WHEN 'pm' THEN 3
          ELSE 4
        END ASC,
        j.id ASC;
    `) as JobRow[];
  } catch (error) {
    console.error("[timetable] query failed:", error);
  }

  const jobs: TimetableJob[] = rows.map((j) => ({
    id: Number(j.job_id),
    customer_id: Number(j.customer_id),
    customer_name: j.customer_name,
    job_type: j.job_type,
    status: j.status,
    quote_amount: j.quote_amount,
    date: calendarYmdFromDbDate(j.date_done),
    time_of_day: j.time_of_day,
  }));

  return (
    <WeeklyTimetable
      weekMonday={weekMonday}
      weekSunday={weekSunday}
      londonTodayYmd={londonTodayYmd}
      jobs={jobs}
    />
  );
}
