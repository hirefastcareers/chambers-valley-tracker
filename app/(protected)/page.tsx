import Link from "next/link";
import { ClipboardList, Settings, Users } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import StatusIndicator from "@/components/StatusIndicator";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import { getSql } from "@/lib/db";
import { getUserById } from "@/lib/user";
import type { JobStatus } from "@/lib/status";
import DashboardFollowUpsSection from "@/components/DashboardFollowUpsSection";
import DashboardGreeting from "@/components/DashboardGreeting";
import DashboardNotificationPrompt from "@/components/DashboardNotificationPrompt";
import DashboardWeatherWidget from "@/components/DashboardWeatherWidget";
import DashboardUpcomingSection, { type UpcomingJobItem } from "@/components/DashboardUpcomingSection";
import { buildWeeklyEarningsSummary, weeklyEarningsUnavailableSummary } from "@/lib/weeklyEarnings";

/**
 * Upcoming jobs list — executed via `sql.query()` so we log the exact string and params Neon receives.
 * `date_done::date` keeps ordering correct even if the column were ever widened to timestamp/text.
 */
const UPCOMING_JOBS_SQL = `
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
WHERE j.status <> 'completed'::job_status
  AND j.user_id = $1
  AND c.user_id = $1
ORDER BY
  j.date_done::date ASC NULLS LAST,
  CASE j.time_of_day
    WHEN 'am' THEN 1
    WHEN 'pm' THEN 2
    WHEN 'all_day' THEN 3
    ELSE 4
  END ASC,
  j.id ASC
LIMIT 1000
`.trim();

function greetingForNow(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function toISODateLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTaxYearRange(now: Date) {
  const year = now.getFullYear();
  const april6ThisYear = new Date(year, 3, 6);
  if (now >= april6ThisYear) {
    return { start: april6ThisYear, end: new Date(year + 1, 3, 5) };
  }
  return { start: new Date(year - 1, 3, 6), end: new Date(year, 3, 5) };
}

/** London calendar date as `YYYY-MM-DD` (matches DB `(AT TIME ZONE 'Europe/London')::date` semantics). */
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
  // Intl may return unpadded month/day in some runtimes — strict YYYY-MM-DD for string compare
  return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await getUserById(userId);
  const businessName = user?.business_name?.trim() || "Patch";

  const now = new Date();

  type FollowUpDueRow = {
    follow_up_id: number | string;
    customer_id: number | string;
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
  type UpcomingJobRow = Omit<JobRowBase, "date_done"> & { date_done: string | null };
  type RecentJobRow = JobRowBase;

  type SettingsRow = { value: string };
  type WeeklyStatsRow = {
    week_monday: string;
    week_sunday: string;
    earned: string | number | null;
    potential: string | number | null;
  };

  const londonTodayYmd = londonCalendarYmd(now);

  let followUpsDueRowsRaw: FollowUpDueRow[] = [];
  let recurringDueRowsRaw: RecurringDueRow[] = [];
  let upcomingJobsRowsRaw: UpcomingJobRow[] = [];
  let recentJobsRowsRaw: RecentJobRow[] = [];

  let weeklyEarnings = weeklyEarningsUnavailableSummary();
  let displayedWeekMondayYmd: string | null = null;
  let displayedWeekSundayYmd: string | null = null;

  type MileageAggRow = { mileage_count: number | string; mileage_total: number | string };
  let taxYearMileageRows: MileageAggRow[] = [{ mileage_count: 0, mileage_total: 0 }];
  let displayedWeekMileageRows: MileageAggRow[] = [{ mileage_count: 0, mileage_total: 0 }];

  const { start: taxYearStart, end: taxYearEnd } = getTaxYearRange(now);
  const taxYearStartStr = toISODateLocal(taxYearStart);
  const taxYearEndStr = toISODateLocal(taxYearEnd);

  try {
    const sql = getSql();
    const primaryLabels = ["followUps", "recurring", "upcoming", "recent"] as const;
    const primarySettled = await Promise.allSettled([
      sql`
      SELECT
        f.id AS follow_up_id,
        c.id AS customer_id,
        c.name AS customer_name,
        f.follow_up_date,
        COALESCE(f.notes, '') AS follow_up_notes
      FROM follow_ups f
      JOIN customers c ON c.id = f.customer_id
      WHERE f.user_id = ${userId}
        AND c.user_id = ${userId}
        AND f.completed = false
        AND f.follow_up_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
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
      WHERE r.user_id = ${userId}
        AND c.user_id = ${userId}
        AND r.active = true
        AND r.next_due_date <= ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date + interval '7 days')
      ORDER BY r.next_due_date ASC
      LIMIT 50;
    `,
      (() => {
        const params: unknown[] = [userId];
        console.log("[dashboard] Neon SQL (upcoming jobs)", {
          query: UPCOMING_JOBS_SQL,
          params,
        });
        return sql.query(UPCOMING_JOBS_SQL, params);
      })(),
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
      WHERE j.user_id = ${userId}
        AND c.user_id = ${userId}
        AND j.date_done IS NOT NULL
        AND j.date_done <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
        AND j.status = 'completed'::job_status
      ORDER BY j.date_done DESC, j.created_at DESC
      LIMIT 5;
    `,
    ]);

    for (let i = 0; i < primarySettled.length; i++) {
      const r = primarySettled[i]!;
      if (r.status === "rejected") {
        const reason = r.reason;
        console.error(
          `[dashboard] query ${primaryLabels[i]} failed:`,
          reason instanceof Error ? reason.message : reason,
          reason instanceof Error ? reason.stack : undefined
        );
      }
    }

    followUpsDueRowsRaw =
      primarySettled[0]!.status === "fulfilled" ? (primarySettled[0].value as FollowUpDueRow[]) : [];
    recurringDueRowsRaw =
      primarySettled[1]!.status === "fulfilled" ? (primarySettled[1].value as RecurringDueRow[]) : [];
    upcomingJobsRowsRaw =
      primarySettled[2]!.status === "fulfilled" ? (primarySettled[2].value as UpcomingJobRow[]) : [];
    recentJobsRowsRaw =
      primarySettled[3]!.status === "fulfilled" ? (primarySettled[3].value as RecentJobRow[]) : [];

    const [weeklyTargetRow, weeklyStatsRows] = await Promise.all([
      sql`
        SELECT value
        FROM settings
        WHERE key = 'weekly_target'
          AND user_id = ${userId}
        LIMIT 1;
      `,
      sql`
        WITH lt AS (
          SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date AS d
        ),
        week_parts AS (
          SELECT
            d,
            date_trunc('week', d::timestamp)::date AS raw_monday
          FROM lt
        ),
        candidate AS (
          SELECT raw_monday AS candidate_monday
          FROM week_parts
        ),
        week_options AS (
          SELECT
            s.idx AS k,
            (c.candidate_monday + (s.idx * interval '7 days'))::date AS week_m
          FROM candidate c
          CROSS JOIN LATERAL (
            VALUES
              (0),
              (1),
              (2),
              (3),
              (4),
              (5),
              (6),
              (7),
              (8),
              (9),
              (10),
              (11),
              (12)
          ) AS s(idx)
        ),
        with_flags AS (
          SELECT
            wo.k,
            wo.week_m,
            (
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
                +
                COALESCE(
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
              WHERE j2.user_id = ${userId}
                AND j2.date_done IS NOT NULL
                AND j2.date_done::date >= wo.week_m
                AND j2.date_done::date <= (wo.week_m + interval '6 days')::date
            )::numeric AS money_w,
            EXISTS (
              SELECT 1
              FROM jobs j
              WHERE j.user_id = ${userId}
                AND j.date_done IS NOT NULL
                AND (j.status = 'quoted'::job_status OR j.status = 'booked'::job_status)
                AND j.quote_amount IS NOT NULL
                AND j.date_done::date >= (SELECT d FROM lt)
                AND j.date_done::date >= wo.week_m
                AND j.date_done::date <= (wo.week_m + interval '6 days')::date
            ) AS pipe_w
          FROM week_options wo
        ),
        picked_monday AS (
          SELECT COALESCE(
            (SELECT wf.week_m FROM with_flags wf WHERE wf.pipe_w ORDER BY wf.k ASC LIMIT 1),
            (SELECT wf.week_m FROM with_flags wf WHERE wf.money_w > 0 ORDER BY wf.k ASC LIMIT 1),
            (SELECT wo.week_m FROM week_options wo WHERE wo.k = 0 LIMIT 1)
          ) AS week_monday
        ),
        bounds AS (
          SELECT
            pm.week_monday,
            (pm.week_monday + interval '6 days')::date AS week_sunday
          FROM picked_monday pm
        )
        SELECT
          b.week_monday::text AS week_monday,
          b.week_sunday::text AS week_sunday,
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
          j.user_id = ${userId}
          AND j.date_done IS NOT NULL
          AND j.date_done::date >= b.week_monday
          AND j.date_done::date <= b.week_sunday
        GROUP BY b.week_monday, b.week_sunday;
      `,
    ]);
    const weeklyTargetTyped = weeklyTargetRow as SettingsRow[];
    const weeklyStatsTyped = weeklyStatsRows as WeeklyStatsRow[];
    const weeklyStats = weeklyStatsTyped[0];
    if (weeklyStats?.week_monday && weeklyStats?.week_sunday) {
      displayedWeekMondayYmd = weeklyStats.week_monday;
      displayedWeekSundayYmd = weeklyStats.week_sunday;
      try {
        weeklyEarnings = buildWeeklyEarningsSummary({
          weekMondayYmd: weeklyStats.week_monday,
          weekSundayYmd: weeklyStats.week_sunday,
          earnedRaw: weeklyStats.earned,
          potentialRaw: weeklyStats.potential,
          weeklyTargetRaw: weeklyTargetTyped[0]?.value ?? user?.weekly_target,
        });
      } catch (summErr) {
        console.error("[dashboard] buildWeeklyEarningsSummary failed:", summErr);
        weeklyEarnings = weeklyEarningsUnavailableSummary();
      }
    }

    const pair = await Promise.all([
      sql`
      SELECT
        COUNT(mileage_miles) AS mileage_count,
        COALESCE(SUM(mileage_miles), 0) AS mileage_total
      FROM jobs
      WHERE user_id = ${userId}
        AND status = 'completed'
        AND date_done >= ${taxYearStartStr}::date
        AND date_done <= ${taxYearEndStr}::date;
    `,
      displayedWeekMondayYmd && displayedWeekSundayYmd
        ? sql`
          SELECT
            COUNT(mileage_miles) AS mileage_count,
            COALESCE(SUM(mileage_miles), 0) AS mileage_total
          FROM jobs
          WHERE user_id = ${userId}
            AND status = 'completed'
            AND date_done >= ${displayedWeekMondayYmd}::date
            AND date_done <= ${displayedWeekSundayYmd}::date;
        `
        : sql`SELECT 0::int AS mileage_count, 0::numeric AS mileage_total;`,
    ]);
    taxYearMileageRows = pair[0] as MileageAggRow[];
    displayedWeekMileageRows = pair[1] as MileageAggRow[];
  } catch (error) {
    console.error("[dashboard] fatal error:", error);
    if (error instanceof Error) {
      console.error("[dashboard] fatal error stack:", error.stack);
    }
    if (process.env.DASHBOARD_THROW_ON_FATAL === "1") {
      throw error;
    }
  }

  if (process.env.DEBUG_UPCOMING_JOBS === "1") {
    console.info("[dashboard] upcoming jobs", {
      londonToday: londonTodayYmd,
      upcomingSql: UPCOMING_JOBS_SQL,
      upcomingParams: [] as unknown[],
      rowCount: upcomingJobsRowsRaw.length,
      jobIds: upcomingJobsRowsRaw.map((j) => j.job_id),
    });
  }

  const followUpsDueRows: FollowUpDueRow[] = followUpsDueRowsRaw.map((r) => ({
    follow_up_id: Number(r.follow_up_id),
    customer_id: Number(r.customer_id),
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
  const upcomingItems: UpcomingJobItem[] = upcomingJobsRows.map((j) => {
    const raw = j.date_done;
    const dateYmdRaw =
      raw == null || raw === ""
        ? ""
        : String(raw).includes("T")
          ? String(raw).split("T")[0]!
          : String(raw).slice(0, 10);
    const ymdParts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateYmdRaw.trim());
    const dateYmd = ymdParts
      ? `${ymdParts[1]}-${ymdParts[2].padStart(2, "0")}-${ymdParts[3].padStart(2, "0")}`
      : "";
    return {
      id: j.job_id,
      customer_id: j.customer_id,
      customer_name: j.customer_name,
      job_type: j.job_type,
      status: j.status,
      quote_amount: j.quote_amount,
      date: j.date_done ?? "",
      time_of_day: j.time_of_day,
      isOverdue:
        j.status !== "completed" &&
        Boolean(dateYmd) &&
        Boolean(londonTodayYmd) &&
        dateYmd < londonTodayYmd,
    };
  });

  const taxYearMileageRow = taxYearMileageRows[0];
  const displayedWeekMileageRow = displayedWeekMileageRows[0];
  const hasAnyMileage = Number(taxYearMileageRow?.mileage_count ?? 0) > 0;
  const mileageSummary = hasAnyMileage
    ? {
        weekMiles: Number(displayedWeekMileageRow?.mileage_total ?? 0),
        taxYearMiles: Number(taxYearMileageRow?.mileage_total ?? 0),
      }
    : null;

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
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="min-w-0 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-semibold text-[var(--c-text)] tracking-tight md:max-w-none md:flex-1"
                title={businessName}
              >
                {businessName}
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                <span className="hidden sm:inline text-[13px] text-[var(--c-text-muted)] tabular-nums">{formatDateDDMMYYYY(now)}</span>
                <Link
                  href="/customers"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[20px] border border-[var(--c-border-strong)] bg-white px-[14px] py-[5px] text-[13px] font-medium text-[var(--c-text)] touch-manipulation active:opacity-90"
                >
                  <Users className="h-4 w-4 shrink-0" aria-hidden />
                  Customers
                </Link>
                <Link href="/settings" className="inline-flex shrink-0 items-center text-[var(--c-text-muted)]" aria-label="Open settings">
                  <Settings className="h-4 w-4" />
                </Link>
                <UserButton />
              </div>
            </div>
          </PageHeader>
          <div className="mt-2">
            <DashboardGreeting greeting={greetingForNow(now)} initialFollowUpsDue={followUpsDueRows} />
            <DashboardNotificationPrompt />
          </div>
        </div>

        <DashboardWeatherWidget />

        <DashboardFollowUpsSection initialFollowUpsDue={followUpsDueRows} initialRecurringDue={recurringDueRows} />

        <DashboardUpcomingSection
          initialItems={upcomingItems}
          weeklyEarnings={weeklyEarnings}
          mileageSummary={mileageSummary}
        />

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
