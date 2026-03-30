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

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  async function markPaid(jobId: number) {
    const snapshot = localRows.find((r) => r.jobId === jobId);
    setLocalRows((prev) => prev.filter((r) => r.jobId !== jobId));

    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/mark-paid`, { method: "POST" });
        if (!res.ok) {
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
    <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[var(--c-text)]">Outstanding / unpaid</div>
          <div className="text-[13px] text-[var(--c-text-muted)] mt-1">Completed jobs where payment is still pending</div>
        </div>
        <div className="font-currency text-[17px] text-[var(--c-text)]">{formatMoneyGBP(total)}</div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {localRows.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-10 text-center">
            <div className="flex justify-center mb-3 text-[var(--c-text-muted)]" aria-hidden>
              <Briefcase className="w-10 h-10 stroke-[1.5]" />
            </div>
            <p className="text-[15px] font-semibold text-[var(--c-text)]">Nothing outstanding</p>
            <p className="text-[13px] text-[var(--c-text-muted)] mt-2">You&apos;re all caught up.</p>
          </div>
        ) : (
          localRows.map((r) => (
            <div
              key={r.jobId}
              className="rounded-[12px] border border-[var(--c-border)] p-3 flex items-start justify-between gap-3 bg-[var(--c-surface)] clickable-card"
            >
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[var(--c-text)] truncate">{r.customerName}</div>
                <div className="text-[13px] text-[var(--c-text)] mt-1">{r.jobType}</div>
                <div className="text-[13px] text-[var(--c-text-muted)] mt-1">{r.date_done ? formatDateDDMMYYYY(r.date_done) : "—"}</div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className="font-currency text-[17px] text-[var(--c-text)]">{formatMoneyGBP(r.quote_amount)}</div>
                <button
                  type="button"
                  onClick={() => markPaid(r.jobId)}
                  className="px-5 py-3 rounded-[10px] bg-[var(--c-primary)] text-white text-[15px] font-semibold btn-primary-interactive"
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
