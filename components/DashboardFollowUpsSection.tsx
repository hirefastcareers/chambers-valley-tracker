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

function followUpLeftBorderClass(followUpDate: string | Date): string {
  const due = parseDateStartOfDayLocal(followUpDate);
  const today = startOfTodayLocal();
  if (!due) return "border-l-[4px] border-l-[var(--color-primary)]";
  if (due < today) return "border-l-[4px] border-l-[var(--color-danger)]";
  if (due.getTime() === today.getTime()) return "border-l-[4px] border-l-[var(--color-warning)]";
  return "border-l-[4px] border-l-[var(--color-primary)]";
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
  const [exitingFollowUpIds, setExitingFollowUpIds] = useState<Set<number>>(() => new Set());
  const [exitingRecurringIds, setExitingRecurringIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setFollowUpsDueRows(initialFollowUpsDue);
    setRecurringDueRows(initialRecurringDue);
  }, [initialFollowUpsDue, initialRecurringDue]);

  function markFollowUpDone(row: FollowUpDueRow) {
    const id = Number(row.follow_up_id);
    const snapshot = { ...row };
    setExitingFollowUpIds((prev) => new Set(prev).add(id));

    const removeTimeout = window.setTimeout(() => {
      setFollowUpsDueRows((prev) => prev.filter((r) => Number(r.follow_up_id) !== id));
      setExitingFollowUpIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);

    void (async () => {
      try {
        const res = await fetch(`/api/follow-ups/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!res.ok) {
          window.clearTimeout(removeTimeout);
          setExitingFollowUpIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setFollowUpsDueRows((prev) => {
            if (prev.some((r) => Number(r.follow_up_id) === id)) return prev;
            return [...prev, snapshot].sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));
          });
          return;
        }
        router.refresh();
      } catch {
        window.clearTimeout(removeTimeout);
        setExitingFollowUpIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setFollowUpsDueRows((prev) => {
          if (prev.some((r) => Number(r.follow_up_id) === id)) return prev;
          return [...prev, snapshot].sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));
        });
      }
    })();
  }

  function markRecurringDone(row: RecurringDueRow) {
    const id = Number(row.reminder_id);
    const snapshot = { ...row };
    setExitingRecurringIds((prev) => new Set(prev).add(id));

    const removeTimeout = window.setTimeout(() => {
      setRecurringDueRows((prev) => prev.filter((r) => Number(r.reminder_id) !== id));
      setExitingRecurringIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);

    void (async () => {
      try {
        const res = await fetch(`/api/recurring-reminders/${id}/done`, { method: "POST" });
        if (!res.ok) {
          window.clearTimeout(removeTimeout);
          setExitingRecurringIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setRecurringDueRows((prev) => {
            if (prev.some((r) => Number(r.reminder_id) === id)) return prev;
            return [...prev, snapshot].sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)));
          });
          return;
        }
        router.refresh();
      } catch {
        window.clearTimeout(removeTimeout);
        setExitingRecurringIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setRecurringDueRows((prev) => {
          if (prev.some((r) => Number(r.reminder_id) === id)) return prev;
          return [...prev, snapshot].sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)));
        });
      }
    })();
  }

  return (
    <>
      {followUpsDueRows.length > 0 ? (
        <Card>
          <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--color-border)]">
            <div>
              <div className="section-label-card">Follow-ups due</div>
              <div className="text-[14px] text-[var(--color-text-muted)] mt-1">{followUpsDueRows.length} due</div>
            </div>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {followUpsDueRows.map((f) => {
              const id = Number(f.follow_up_id);
              const exiting = exitingFollowUpIds.has(id);
              const left = followUpLeftBorderClass(f.follow_up_date);
              return (
                <div
                  key={id}
                  className={[
                    "flex items-start justify-between gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] clickable-card",
                    left,
                    exiting ? "animate-row-exit" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] text-[var(--color-text)] truncate">{f.customer_name}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">Due: {formatDateDDMMYYYY(f.follow_up_date)}</div>
                    {f.follow_up_notes ? (
                      <div className="text-sm text-[var(--color-text)] mt-2 overflow-hidden text-ellipsis whitespace-nowrap">{f.follow_up_notes}</div>
                    ) : null}
                  </div>
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => markFollowUpDone(f)}
                      className="px-4 py-2 rounded-[12px] bg-[var(--color-primary)] text-white text-[15px] font-semibold btn-primary-interactive"
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
          <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--color-border)]">
            <div>
              <div className="section-label-card">Recurring jobs</div>
              <div className="text-[14px] text-[var(--color-text-muted)] mt-1">{recurringDueRows.length} due (7 days)</div>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {recurringDueRows.map((r) => {
              const id = Number(r.reminder_id);
              const exiting = exitingRecurringIds.has(id);
              return (
                <div
                  key={id}
                  className={[
                    "flex items-start justify-between gap-3 rounded-[14px] border border-[var(--color-border)] border-l-[4px] border-l-[var(--color-info)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] clickable-card",
                    exiting ? "animate-row-exit" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] text-[var(--color-text)] truncate">{r.customer_name}</div>
                    <div className="text-sm text-[var(--color-text)] mt-1">{r.job_type}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">Next due: {formatDateDDMMYYYY(r.next_due_date)}</div>
                  </div>
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => markRecurringDone(r)}
                      className="px-4 py-2 rounded-[12px] bg-[var(--color-primary)] text-white text-[15px] font-semibold btn-primary-interactive"
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
