"use client";

import { useState } from "react";
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
  const [busyId, setBusyId] = useState<number | null>(null);

  async function markPaid(jobId: number) {
    if (busyId) return;
    setBusyId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/mark-paid`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[#2d6a4f] font-semibold">Outstanding / unpaid</div>
          <div className="text-xs text-zinc-600 mt-1">Completed jobs where payment is still pending</div>
        </div>
        <div className="text-lg font-semibold text-[#2d6a4f]">{formatMoneyGBP(total)}</div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-600">Nothing outstanding.</div>
        ) : (
          rows.map((r) => (
            <div key={r.jobId} className="rounded-2xl border border-zinc-200 p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 truncate">{r.customerName}</div>
                <div className="text-sm text-zinc-700 mt-1">{r.jobType}</div>
                <div className="text-xs text-zinc-600 mt-1">
                  Date: {r.date_done ? formatDateDDMMYYYY(r.date_done) : "—"}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className="text-sm font-semibold text-zinc-900">{formatMoneyGBP(r.quote_amount)}</div>
                <button
                  type="button"
                  disabled={busyId === r.jobId}
                  onClick={() => markPaid(r.jobId)}
                  className="px-3 py-2 rounded-xl bg-[#2d6a4f] text-white text-sm font-semibold disabled:opacity-60 active:scale-[0.99]"
                >
                  {busyId === r.jobId ? "Updating..." : "Mark as paid"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

