"use client";

import { Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";

type OutstandingRow = {
  jobId: number;
  customerName: string;
  jobType: string;
  date_done: string | null;
  quote_amount: string | number | null;
};

export default function OutstandingJobs({ rows, total }: { rows: OutstandingRow[]; total: number }) {
  const router = useRouter();
  const [localRows, setLocalRows] = useState(rows);
  const [exitingIds, setExitingIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  async function markPaid(jobId: number) {
    const snapshot = localRows.find((r) => r.jobId === jobId);
    setExitingIds((prev) => new Set(prev).add(jobId));

    const removeTimeout = window.setTimeout(() => {
      setLocalRows((prev) => prev.filter((r) => r.jobId !== jobId));
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }, 200);

    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/mark-paid`, { method: "POST" });
        if (!res.ok) {
          window.clearTimeout(removeTimeout);
          setExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
          });
          if (snapshot) {
            setLocalRows((prev) => {
              if (prev.some((r) => r.jobId === jobId)) return prev;
              return [...prev, snapshot];
            });
          }
          return;
        }
        router.refresh();
      } catch {
        window.clearTimeout(removeTimeout);
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        if (snapshot) {
          setLocalRows((prev) => {
            if (prev.some((r) => r.jobId === jobId)) return prev;
            return [...prev, snapshot];
          });
        }
      }
    })();
  }

  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Outstanding / unpaid</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">Completed jobs where payment is still pending</div>
        </div>
        <div className="font-currency text-xl text-[var(--color-text)]">{formatMoneyGBP(total)}</div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {localRows.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-10 text-center">
            <div className="flex justify-center mb-3 text-[var(--color-text-muted)]" aria-hidden>
              <Briefcase className="w-10 h-10 stroke-[1.5]" />
            </div>
            <p className="text-[15px] font-semibold text-[var(--color-text)]">Nothing outstanding</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">You&apos;re all caught up.</p>
          </div>
        ) : (
          localRows.map((r) => (
            <div
              key={r.jobId}
              className={[
                "rounded-[14px] border border-[var(--color-border)] p-3 flex items-start justify-between gap-3 bg-[var(--color-surface)] shadow-[var(--shadow-sm)]",
                exitingIds.has(r.jobId) ? "animate-row-exit" : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--color-text)] truncate">{r.customerName}</div>
                <div className="text-[13px] text-[var(--color-text)] mt-1">{r.jobType}</div>
                <div className="text-[13px] text-[var(--color-text-muted)] mt-1">{r.date_done ? formatDateDDMMYYYY(r.date_done) : "—"}</div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className="font-currency text-[17px] text-[var(--color-text)]">{formatMoneyGBP(r.quote_amount)}</div>
                <button
                  type="button"
                  onClick={() => markPaid(r.jobId)}
                  className="px-3 py-2 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold btn-primary-interactive"
                >
                  Mark as paid
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
