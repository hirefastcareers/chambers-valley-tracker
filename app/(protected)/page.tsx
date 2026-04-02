import Link from "next/link";
import { ClipboardList } from "lucide-react";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import StatusIndicator from "@/components/StatusIndicator";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import { getSql } from "@/lib/db";
import type { JobStatus } from "@/lib/status";
import DashboardFollowUpsSection from "@/components/DashboardFollowUpsSection";
import DashboardWeatherWidget from "@/components/DashboardWeatherWidget";
import DashboardUpcomingSection, { type UpcomingJobItem } from "@/components/DashboardUpcomingSection";
import { buildWeeklyEarningsSummary, weeklyEarningsUnavailableSummary } from "@/lib/weeklyEarnings";

function greetingForNow(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const sql = getSql();
  const now = new Date();

  type FollowUpDueRow = {
    follow_up_id: number | string;
    customer_name: string;
    follow_up_date: string;
    follow_up_notes: string;
  };
  type RecurringDueRow = {
    reminder_id: number | string;
    customer_name: string;
    job_type: string;
    next_due_date: string;
    interval_days: number | string;
  };
  type JobRowBase = {
    job_id: number | string;
    customer_id: number | string;
    customer_name: string;
    job_type: string;
    status: JobStatus;
    quote_amount: string | number | null;
    date_done: string;
    time_of_day: "am" | "pm" | "all_day" | null;
  };
  type UpcomingJobRow = JobRowBase;
  type RecentJobRow = JobRowBase;

  type SettingsRow = { value: string };
  type WeeklyStatsRow = {
    week_monday: string;
    week_friday: string;
    earned: string | number | null;
    potential: string | number | null;
  };

  const [followUpsDue, recurringDue, upcomingJobs, recentJobs] = await Promise.all([
    sql`
      SELECT
        f.id AS follow_up_id,
        c.name AS customer_name,
        f.follow_up_date,
        COALESCE(f.notes, '') AS follow_up_notes
      FROM follow_ups f
      JOIN customers c ON c.id = f.customer_id
      WHERE f.completed = false
        AND f.follow_up_date <= current_date
      ORDER BY f.follow_up_date ASC
      LIMIT 50;
    `,
    sql`
      SELECT
        r.id AS reminder_id,
        c.name AS customer_name,
        r.job_type,
        r.next_due_date,
        r.interval_days
      FROM recurring_reminders r
      JOIN customers c ON c.id = r.customer_id
      WHERE r.active = true
        AND r.next_due_date <= (current_date + interval '7 days')
      ORDER BY r.next_due_date ASC
      LIMIT 50;
    `,
    sql`
      SELECT
        j.id AS job_id,
        c.id AS customer_id,
        c.name AS customer_name,
        j.job_type,
        j.status,
        j.quote_amount,
        j.date_done,
        j.time_of_day
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      WHERE j.date_done IS NOT NULL
        AND DATE(j.date_done) >= CURRENT_DATE
        AND j.status <> 'completed'
      ORDER BY DATE(j.date_done) ASC, j.created_at ASC;
    `,
    sql`
      SELECT
        j.id AS job_id,
        c.id AS customer_id,
        c.name AS customer_name,
        j.job_type,
        j.status,
        j.quote_amount,
        j.date_done,
        j.time_of_day
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      WHERE j.date_done IS NOT NULL
        AND j.date_done < current_date
      ORDER BY j.date_done DESC
      LIMIT 5;
    `,
  ]);

  const followUpsDueRowsRaw = followUpsDue as FollowUpDueRow[];
  const recurringDueRowsRaw = recurringDue as RecurringDueRow[];
  const upcomingJobsRowsRaw = upcomingJobs as UpcomingJobRow[];
  const recentJobsRowsRaw = recentJobs as RecentJobRow[];

  const followUpsDueRows: FollowUpDueRow[] = followUpsDueRowsRaw.map((r) => ({
    follow_up_id: Number(r.follow_up_id),
    customer_name: r.customer_name,
    follow_up_date: r.follow_up_date,
    follow_up_notes: r.follow_up_notes,
  }));
  const recurringDueRows: RecurringDueRow[] = recurringDueRowsRaw.map((r) => ({
    reminder_id: Number(r.reminder_id),
    customer_name: r.customer_name,
    job_type: r.job_type,
    next_due_date: r.next_due_date,
    interval_days: r.interval_days,
  }));
  const upcomingJobsRows = upcomingJobsRowsRaw.map((j) => ({
    job_id: Number(j.job_id),
    customer_id: Number(j.customer_id),
    customer_name: j.customer_name,
    job_type: j.job_type,
    status: j.status,
    quote_amount: j.quote_amount,
    date_done: j.date_done,
    time_of_day: j.time_of_day,
  }));
  const upcomingItems: UpcomingJobItem[] = [
    ...upcomingJobsRows
      .filter((j) => j.status !== "completed")
      .map((j) => ({
        id: j.job_id,
        customer_id: j.customer_id,
        customer_name: j.customer_name,
        job_type: j.job_type,
        status: j.status,
        quote_amount: j.quote_amount,
        date: j.date_done,
        time_of_day: j.time_of_day,
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let weeklyEarnings = weeklyEarningsUnavailableSummary();
  try {
    const [weeklyTargetRow, weeklyStatsRows] = await Promise.all([
      sql`
        SELECT value
        FROM settings
        WHERE key = 'weekly_target'
        LIMIT 1;
      `,
      sql`
        WITH lt AS (
          SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date AS d
        ),
        week_parts AS (
          SELECT
            d,
            EXTRACT(ISODOW FROM d) AS isodow,
            date_trunc('week', d::timestamp)::date AS raw_monday
          FROM lt
        ),
        candidate AS (
          SELECT
            isodow,
            CASE
              WHEN isodow >= 6 THEN (raw_monday + interval '7 days')::date
              ELSE raw_monday
            END AS candidate_monday
          FROM week_parts
        ),
        empty_check AS (
          SELECT
            c.isodow,
            c.candidate_monday,
            CASE
              WHEN c.isodow >= 6 THEN NULL::numeric
              ELSE (
                SELECT
                  COALESCE(
                    SUM(
                      CASE
                        WHEN j2.status = 'completed'::job_status
                          AND j2.paid = true
                          AND j2.quote_amount IS NOT NULL
                        THEN j2.quote_amount
                        ELSE 0
                      END
                    ),
                    0
                  )
                  + COALESCE(
                    SUM(
                      CASE
                        WHEN (
                          j2.status = 'quoted'::job_status
                          OR j2.status = 'booked'::job_status
                        )
                          AND j2.quote_amount IS NOT NULL
                        THEN j2.quote_amount
                        ELSE 0
                      END
                    ),
                    0
                  )
                FROM jobs j2
                WHERE j2.date_done IS NOT NULL
                  AND j2.date_done::date >= c.candidate_monday
                  AND j2.date_done::date <= (c.candidate_monday + interval '4 days')::date
              )
            END AS bar_relevant_week_total
          FROM candidate c
        ),
        picked_monday AS (
          SELECT
            CASE
              WHEN ec.isodow >= 6 THEN ec.candidate_monday
              WHEN COALESCE(ec.bar_relevant_week_total, 0) = 0 THEN (ec.candidate_monday + interval '7 days')::date
              ELSE ec.candidate_monday
            END AS week_monday
          FROM empty_check ec
        ),
        bounds AS (
          SELECT
            pm.week_monday,
            (pm.week_monday + interval '4 days')::date AS week_friday
          FROM picked_monday pm
        )
        SELECT
          b.week_monday::text AS week_monday,
          b.week_friday::text AS week_friday,
          COALESCE(
            SUM(
              CASE
                WHEN j.status = 'completed'::job_status
                  AND j.paid = true
                  AND j.quote_amount IS NOT NULL
                THEN j.quote_amount
                ELSE 0
              END
            ),
            0
          )::numeric AS earned,
          COALESCE(
            SUM(
              CASE
                WHEN (j.status = 'quoted'::job_status OR j.status = 'booked'::job_status)
                  AND j.quote_amount IS NOT NULL
                THEN j.quote_amount
                ELSE 0
              END
            ),
            0
          )::numeric AS potential
        FROM bounds b
        LEFT JOIN jobs j ON
          j.date_done IS NOT NULL
          AND j.date_done::date >= b.week_monday
          AND j.date_done::date <= b.week_friday
        GROUP BY b.week_monday, b.week_friday;
      `,
    ]);
    const weeklyTargetTyped = weeklyTargetRow as SettingsRow[];
    const weeklyStatsTyped = weeklyStatsRows as WeeklyStatsRow[];
    const weeklyStats = weeklyStatsTyped[0];
    if (weeklyStats?.week_monday && weeklyStats?.week_friday) {
      weeklyEarnings = buildWeeklyEarningsSummary({
        weekMondayYmd: weeklyStats.week_monday,
        weekFridayYmd: weeklyStats.week_friday,
        earnedRaw: weeklyStats.earned,
        potentialRaw: weeklyStats.potential,
        weeklyTargetRaw: weeklyTargetTyped[0]?.value,
      });
    }
  } catch {
    weeklyEarnings = weeklyEarningsUnavailableSummary();
  }

  const recentJobsRows = recentJobsRowsRaw.map((j) => ({
    job_id: Number(j.job_id),
    customer_id: Number(j.customer_id),
    customer_name: j.customer_name,
    job_type: j.job_type,
    status: j.status,
    quote_amount: j.quote_amount,
    date_done: j.date_done,
    time_of_day: j.time_of_day,
  }));

  return (
    <div className="flex min-h-0 flex-col bg-[var(--c-bg)]">
      <div className="flex flex-col gap-2">
        <div>
          <PageHeader className="!mb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[17px] font-semibold text-[var(--c-text)] tracking-tight">Patch</span>
              <span className="text-[13px] text-[var(--c-text-muted)] tabular-nums">{formatDateDDMMYYYY(now)}</span>
            </div>
          </PageHeader>
          <div className="mt-2">
            <h1 className="text-[22px] font-semibold text-[var(--c-text)] leading-tight">{greetingForNow(now)}</h1>
          </div>
        </div>

        <DashboardWeatherWidget />

        <DashboardFollowUpsSection initialFollowUpsDue={followUpsDueRows} initialRecurringDue={recurringDueRows} />

        <DashboardUpcomingSection initialItems={upcomingItems} weeklyEarnings={weeklyEarnings} />

        <Card>
          <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--c-border)]">
            <div>
              <div className="section-label-card !mt-0 !mb-0">RECENT JOBS · Last 5</div>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {recentJobsRows.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-12 text-center">
                <div className="flex justify-center mb-4 text-[var(--c-text-muted)]" aria-hidden>
                  <ClipboardList className="w-12 h-12 stroke-[1.5]" />
                </div>
                <p className="text-[15px] font-semibold text-[var(--c-text)]">No jobs logged yet</p>
                <p className="text-[13px] text-[var(--c-text-muted)] mt-2">Add a job from the + button below.</p>
              </div>
            ) : (
              recentJobsRows.map((j) => (
                <Link
                  key={j.job_id}
                  href={`/customers/${j.customer_id}?job_id=${j.job_id}`}
                  className="relative flex items-start justify-between gap-3 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-5 cursor-pointer clickable-card"
                  aria-label={`Open customer ${j.customer_name} for job ${j.job_type}`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-[15px] text-[var(--c-text)] truncate">{j.customer_name}</div>
                    <div className="text-[13px] text-[var(--c-text-muted)] mt-2">{j.job_type}</div>
                    <div className="text-[13px] text-[var(--c-text-muted)] mt-2">
                      {formatDateDDMMYYYY(j.date_done)}
                      {j.time_of_day === "am" ? " · AM" : j.time_of_day === "pm" ? " · PM" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                    <StatusIndicator status={j.status as JobStatus} />
                    <div className="font-currency text-[17px] text-[var(--c-text)]">{formatMoneyGBP(j.quote_amount)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
      <div className="min-h-0 flex-1 shrink-0" aria-hidden />
    </div>
  );
}
