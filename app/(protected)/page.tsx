import Link from "next/link";
import { ClipboardList } from "lucide-react";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import { getSql } from "@/lib/db";
import type { JobStatus } from "@/lib/status";
import DashboardFollowUpsSection from "@/components/DashboardFollowUpsSection";
import DashboardWeatherWidget from "@/components/DashboardWeatherWidget";

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
  type RecentJobRow = {
    job_id: number | string;
    customer_id: number | string;
    customer_name: string;
    job_type: string;
    status: JobStatus;
    quote_amount: string | number | null;
    date_done: string | null;
  };

  const [followUpsDue, recurringDue, recentJobs] = await Promise.all([
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
        j.date_done
      FROM jobs j
      JOIN customers c ON c.id = j.customer_id
      ORDER BY j.date_done DESC NULLS LAST, j.created_at DESC
      LIMIT 5;
    `,
  ]);

  const followUpsDueRowsRaw = followUpsDue as FollowUpDueRow[];
  const recurringDueRowsRaw = recurringDue as RecurringDueRow[];
  const recentJobsRowsRaw = recentJobs as RecentJobRow[];

  // Neon can return BIGINT as bigint — not serializable across the RSC boundary to client components.
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
  const recentJobsRows = recentJobsRowsRaw.map((j) => ({
    job_id: Number(j.job_id),
    customer_id: Number(j.customer_id),
    customer_name: j.customer_name,
    job_type: j.job_type,
    status: j.status,
    quote_amount: j.quote_amount,
    date_done: j.date_done,
  }));

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg)]">
      <div className="flex flex-col gap-6">
        <div>
          <PageHeader className="!mb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[18px] font-bold text-[var(--color-text)] tracking-tight">Patch</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[14px] text-[var(--color-text-muted)] tabular-nums">{formatDateDDMMYYYY(now)}</span>
                <Link
                  href="/?add_job=1"
                  className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center btn-primary-interactive shadow-[var(--shadow-sm)]"
                  aria-label="Add Job"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </Link>
              </div>
            </div>
          </PageHeader>
          <div className="mt-2">
            <h1 className="text-2xl font-bold text-[var(--color-text)] leading-tight">{greetingForNow(now)}</h1>
          </div>
        </div>

        <DashboardWeatherWidget />

        <DashboardFollowUpsSection initialFollowUpsDue={followUpsDueRows} initialRecurringDue={recurringDueRows} />

        <Card>
          <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--color-border)]">
            <div>
              <div className="section-label-card">Recent jobs</div>
              <div className="text-[14px] text-[var(--color-text-muted)] mt-1">Last 5 logged</div>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {recentJobsRows.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-12 text-center">
                <div className="flex justify-center mb-4 text-[var(--color-text-muted)]" aria-hidden>
                  <ClipboardList className="w-12 h-12 stroke-[1.5]" />
                </div>
                <p className="text-[15px] font-semibold text-[var(--color-text)]">No jobs logged yet</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-2">Add a job from the + button below.</p>
              </div>
            ) : (
              recentJobsRows.map((j) => (
                <Link
                  key={j.job_id}
                  href={`/customers/${j.customer_id}?job_id=${j.job_id}`}
                  className="relative flex items-start justify-between gap-3 rounded-[14px] border border-[var(--color-border)] border-l-[4px] border-l-[var(--color-primary)] bg-[var(--color-surface)] p-4 cursor-pointer clickable-card shadow-[var(--shadow-sm)]"
                  aria-label={`Open customer ${j.customer_name} for job ${j.job_type}`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-[15px] text-[var(--color-text)] truncate">{j.customer_name}</div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">{j.job_type}</div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">{formatDateDDMMYYYY(j.date_done)}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                    <StatusBadge status={j.status as JobStatus} />
                    <div className="font-currency text-[17px] text-[var(--color-text)]">{formatMoneyGBP(j.quote_amount)}</div>
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
