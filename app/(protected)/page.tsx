import Link from "next/link";
import Card from "@/components/Card";
import StatusBadge from "@/components/StatusBadge";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import { getSql } from "@/lib/db";
import type { JobStatus } from "@/lib/status";
import MarkFollowUpDoneButton from "@/components/MarkFollowUpDoneButton";
import MarkRecurringDoneButton from "@/components/MarkRecurringDoneButton";

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-zinc-500 text-sm">{formatDateDDMMYYYY(now)}</div>
          <div className="text-[#2d6a4f] font-semibold text-2xl leading-tight">
            {greetingForNow(now)}
          </div>
        </div>

        <Link
          href="/?add_job=1"
          className="w-12 h-12 rounded-2xl bg-[#2d6a4f] text-white flex items-center justify-center shadow-md active:scale-[0.98]"
          aria-label="Add Job"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </Link>
      </div>

      <Card>
        <div className="p-4 flex items-center justify-between border-b border-zinc-200">
          <div>
            <div className="text-[#2d6a4f] font-semibold">Follow-ups due</div>
            <div className="text-xs text-zinc-600">{followUpsDueRows.length} due</div>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {followUpsDueRows.length === 0 ? (
            <div className="text-sm text-zinc-600">Nothing due today.</div>
          ) : (
            followUpsDueRows.map((f) => (
              <div key={f.follow_up_id} className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900 truncate">
                    {f.customer_name}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Due: {formatDateDDMMYYYY(f.follow_up_date)}
                  </div>
                  {f.follow_up_notes ? (
                    <div className="text-sm text-zinc-800 mt-2 overflow-hidden text-ellipsis whitespace-nowrap">
                      {f.follow_up_notes}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0">
                  <MarkFollowUpDoneButton followUpId={Number(f.follow_up_id)} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4 flex items-center justify-between border-b border-zinc-200">
          <div>
            <div className="text-[#2d6a4f] font-semibold">Recurring jobs due</div>
            <div className="text-xs text-zinc-600">{recurringDueRows.length} due (7 days)</div>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {recurringDueRows.length === 0 ? (
            <div className="text-sm text-zinc-600">No recurring jobs due soon.</div>
          ) : (
            recurringDueRows.map((r) => (
              <div key={r.reminder_id} className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900 truncate">
                    {r.customer_name}
                  </div>
                  <div className="text-sm text-zinc-800 mt-1">{r.job_type}</div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Next due: {formatDateDDMMYYYY(r.next_due_date)}
                  </div>
                </div>
                <div className="shrink-0">
                  <MarkRecurringDoneButton reminderId={Number(r.reminder_id)} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4 flex items-center justify-between border-b border-zinc-200">
          <div>
            <div className="text-[#2d6a4f] font-semibold">Recent jobs</div>
            <div className="text-xs text-zinc-600">Last 5 logged</div>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {recentJobsRows.length === 0 ? (
            <div className="text-sm text-zinc-600">No jobs yet.</div>
          ) : (
            recentJobsRows.map((j) => (
              <div key={j.job_id} className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900 truncate">
                    {j.customer_name}
                  </div>
                  <div className="text-sm text-zinc-800 mt-1">{j.job_type}</div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Date: {formatDateDDMMYYYY(j.date_done)}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <StatusBadge status={j.status as JobStatus} />
                  <div className="text-sm font-semibold text-zinc-900">{formatMoneyGBP(j.quote_amount)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

