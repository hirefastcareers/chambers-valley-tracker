import Link from "next/link";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import { getSql } from "@/lib/db";
import type { JobStatus } from "@/lib/status";
import TodayNotesCard from "@/components/TodayNotesCard";
import DashboardFollowUpsSection from "@/components/DashboardFollowUpsSection";

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

  type TodayNoteRow = { note_text: string | null };

  const [todayNotes, followUpsDue, recurringDue, recentJobs] = await Promise.all([
    sql`SELECT note_text FROM dashboard_notes WHERE date = current_date LIMIT 1;`,
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
      ORDER BY j.created_at DESC
      LIMIT 5;
    `,
  ]);

  const followUpsDueRows = followUpsDue as FollowUpDueRow[];
  const recurringDueRows = recurringDue as RecurringDueRow[];
  const recentJobsRows = recentJobs as RecentJobRow[];
  const todayNoteText = (todayNotes as TodayNoteRow[])[0]?.note_text ?? "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase font-semibold text-[#52b788] tracking-[0.08em]">
              {formatDateDDMMYYYY(now)}
            </div>
            <div className="font-display text-white font-normal text-[32px] leading-tight mt-1">
              {greetingForNow(now)}
            </div>
          </div>

          <Link
            href="/?add_job=1"
            className="w-12 h-12 rounded-full bg-white/15 text-[#1a4731] flex items-center justify-center btn-primary-interactive ring-1 ring-white/20"
            aria-label="Add Job"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </Link>
        </div>
      </PageHeader>

      <TodayNotesCard initialNoteText={todayNoteText} />

      <DashboardFollowUpsSection
        initialFollowUpsDue={followUpsDueRows}
        initialRecurringDue={recurringDueRows}
      />

      <Card>
        <div className="px-[18px] py-4 flex items-center justify-between border-b border-[var(--color-border)]">
          <div>
            <h2 className="font-display text-[18px] text-[#1a4731] font-normal">Recent jobs</h2>
            <div className="text-[12px] text-[var(--color-primary-light)] mt-0.5">Last 5 logged</div>
          </div>
        </div>
        <div className="p-[18px] flex flex-col gap-3">
          {recentJobsRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[#f6faf6]/80 px-[18px] py-12 text-center">
              <div className="text-5xl mb-4" aria-hidden>
                🌿
              </div>
              <p className="font-display text-[18px] text-[#1a4731]">No jobs logged yet</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">Add a job from the + button below.</p>
            </div>
          ) : (
            recentJobsRows.map((j) => (
              <Link
                key={j.job_id}
                href={`/customers/${j.customer_id}?job_id=${j.job_id}`}
                className="relative flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3 bg-[#f8faf8] cursor-pointer clickable-card"
                aria-label={`Open customer ${j.customer_name} for job ${j.job_type}`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-display font-semibold text-[var(--color-text)] truncate text-[15px]">
                    {j.customer_name}
                  </div>
                  <div className="text-[13px] text-[var(--color-text-muted)] mt-1">{j.job_type}</div>
                  <div className="text-[13px] text-[var(--color-text-muted)] mt-1">
                    {formatDateDDMMYYYY(j.date_done)}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                  <StatusBadge status={j.status as JobStatus} />
                  <div className="font-display text-[17px] text-[#2d6a4f] font-normal">{formatMoneyGBP(j.quote_amount)}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
