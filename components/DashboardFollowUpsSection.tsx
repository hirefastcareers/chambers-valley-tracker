"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { formatDateDDMMYYYY, parseDateStartOfDayLocal, startOfTodayLocal } from "@/lib/format";

export type FollowUpDueRow = {
  follow_up_id: number | string;
  customer_name: string;
  follow_up_date: string | Date;
  follow_up_notes: string;
};

export type RecurringDueRow = {
  reminder_id: number | string;
  customer_name: string;
  job_type: string;
  next_due_date: string;
  interval_days: number | string;
};

/** Dot + label for due urgency (not job status). */
function dueIndicatorClass(followUpDate: string | Date): string {
  const due = parseDateStartOfDayLocal(followUpDate);
  const today = startOfTodayLocal();
  if (!due) return "var(--c-text-muted)";
  if (due < today) return "var(--c-danger)";
  if (due.getTime() === today.getTime()) return "var(--c-warning)";
  return "var(--c-text-muted)";
}

export default function DashboardFollowUpsSection({
  initialFollowUpsDue,
  initialRecurringDue,
}: {
  initialFollowUpsDue: FollowUpDueRow[];
  initialRecurringDue: RecurringDueRow[];
}) {
  const router = useRouter();
  const [followUpsDueRows, setFollowUpsDueRows] = useState(initialFollowUpsDue);
  const [recurringDueRows, setRecurringDueRows] = useState(initialRecurringDue);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [recurringError, setRecurringError] = useState<string | null>(null);

  useEffect(() => {
    setFollowUpsDueRows(initialFollowUpsDue);
    setRecurringDueRows(initialRecurringDue);
  }, [initialFollowUpsDue, initialRecurringDue]);

  function markFollowUpDone(row: FollowUpDueRow) {
    const id = Number(row.follow_up_id);
    const snapshot = { ...row };
    setFollowUpError(null);
    setFollowUpsDueRows((prev) => prev.filter((r) => Number(r.follow_up_id) !== id));

    void (async () => {
      try {
        const res = await fetch(`/api/follow-ups/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!res.ok) {
          setFollowUpsDueRows((prev) => {
            if (prev.some((r) => Number(r.follow_up_id) === id)) return prev;
            return [...prev, snapshot].sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));
          });
          setFollowUpError("Could not update follow-up");
          window.setTimeout(() => setFollowUpError(null), 3200);
          return;
        }
        router.refresh();
      } catch {
        setFollowUpsDueRows((prev) => {
          if (prev.some((r) => Number(r.follow_up_id) === id)) return prev;
          return [...prev, snapshot].sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));
        });
        setFollowUpError("Could not update follow-up");
        window.setTimeout(() => setFollowUpError(null), 3200);
      }
    })();
  }

  function markRecurringDone(row: RecurringDueRow) {
    const id = Number(row.reminder_id);
    const snapshot = { ...row };
    setRecurringError(null);
    setRecurringDueRows((prev) => prev.filter((r) => Number(r.reminder_id) !== id));

    void (async () => {
      try {
        const res = await fetch(`/api/recurring-reminders/${id}/done`, { method: "POST" });
        if (!res.ok) {
          setRecurringDueRows((prev) => {
            if (prev.some((r) => Number(r.reminder_id) === id)) return prev;
            return [...prev, snapshot].sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)));
          });
          setRecurringError("Could not update reminder");
          window.setTimeout(() => setRecurringError(null), 3200);
          return;
        }
        router.refresh();
      } catch {
        setRecurringDueRows((prev) => {
          if (prev.some((r) => Number(r.reminder_id) === id)) return prev;
          return [...prev, snapshot].sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)));
        });
        setRecurringError("Could not update reminder");
        window.setTimeout(() => setRecurringError(null), 3200);
      }
    })();
  }

  return (
    <>
      {followUpsDueRows.length > 0 ? (
        <Card>
          <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--c-border)]">
            <div>
              <div className="section-label-card !mt-0">Follow-ups due</div>
              <div className="text-[13px] text-[var(--c-text-muted)] mt-1">{followUpsDueRows.length} due</div>
            </div>
          </div>

          {followUpError ? (
            <div className="px-4 pt-2 text-[13px] text-[var(--c-danger)]">{followUpError}</div>
          ) : null}

          <div className="p-4 flex flex-col gap-2">
            {followUpsDueRows.map((f) => {
              const id = Number(f.follow_up_id);
              const dotColor = dueIndicatorClass(f.follow_up_date);
              return (
                <div
                  key={id}
                  className="flex items-start justify-between gap-3 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4 clickable-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden />
                      <div className="font-semibold text-[15px] text-[var(--c-text)] truncate">{f.customer_name}</div>
                    </div>
                    <div className="text-[13px] text-[var(--c-text-muted)] mt-1 pl-3.5">Due: {formatDateDDMMYYYY(f.follow_up_date)}</div>
                    {f.follow_up_notes ? (
                      <div className="text-[13px] text-[var(--c-text)] mt-2 overflow-hidden text-ellipsis whitespace-nowrap pl-3.5">
                        {f.follow_up_notes}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => markFollowUpDone(f)}
                      className="px-5 py-3 rounded-[10px] bg-[var(--c-primary)] text-white text-[15px] font-semibold btn-primary-interactive"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {recurringDueRows.length > 0 ? (
        <Card>
          <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--c-border)]">
            <div>
              <div className="section-label-card !mt-0">Recurring jobs</div>
              <div className="text-[13px] text-[var(--c-text-muted)] mt-1">{recurringDueRows.length} due (7 days)</div>
            </div>
          </div>

          {recurringError ? (
            <div className="px-4 pt-2 text-[13px] text-[var(--c-danger)]">{recurringError}</div>
          ) : null}

          <div className="p-4 flex flex-col gap-2">
            {recurringDueRows.map((r) => {
              const id = Number(r.reminder_id);
              return (
                <div
                  key={id}
                  className="flex items-start justify-between gap-3 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4 clickable-card"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] text-[var(--c-text)] truncate">{r.customer_name}</div>
                    <div className="text-[13px] text-[var(--c-text)] mt-1">{r.job_type}</div>
                    <div className="text-[13px] text-[var(--c-text-muted)] mt-1">Next due: {formatDateDDMMYYYY(r.next_due_date)}</div>
                  </div>
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => markRecurringDone(r)}
                      className="px-5 py-3 rounded-[10px] bg-[var(--c-primary)] text-white text-[15px] font-semibold btn-primary-interactive"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </>
  );
}
