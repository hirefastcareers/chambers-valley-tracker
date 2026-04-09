"use client";

import { useState } from "react";
import { formatMoneyGBP } from "@/lib/format";
import { cn } from "@/lib/cn";

export type TaxYearTotalKey = "2025_26" | "2026_27";

export default function TaxYearEarningsTotal({
  total2025_26,
  total2026_27,
  defaultYear,
}: {
  total2025_26: number;
  total2026_27: number;
  defaultYear: TaxYearTotalKey;
}) {
  const [year, setYear] = useState<TaxYearTotalKey>(defaultYear);
  const total = year === "2025_26" ? total2025_26 : total2026_27;

  return (
    <div>
      <div className="text-[15px] font-semibold text-[var(--c-text)]">Tax year total</div>
      <p className="mt-1 text-xs text-[var(--c-text-muted)]">Paid jobs only (same basis as YTD)</p>

      <div
        className="mt-4 grid grid-cols-2 gap-2 overflow-hidden rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] p-1"
        role="tablist"
        aria-label="Tax year"
      >
        <button
          type="button"
          role="tab"
          aria-selected={year === "2025_26"}
          onClick={() => setYear("2025_26")}
          className={cn(
            "rounded-[10px] px-3 py-2.5 text-sm font-semibold touch-manipulation transition-colors",
            year === "2025_26"
              ? "bg-[var(--c-text)] text-white"
              : "text-[var(--c-text-muted)] active:bg-[#fafafa]"
          )}
        >
          2025/26
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={year === "2026_27"}
          onClick={() => setYear("2026_27")}
          className={cn(
            "rounded-[10px] px-3 py-2.5 text-sm font-semibold touch-manipulation transition-colors",
            year === "2026_27"
              ? "bg-[var(--c-text)] text-white"
              : "text-[var(--c-text-muted)] active:bg-[#fafafa]"
          )}
        >
          2026/27
        </button>
      </div>

      <div className="mt-4 text-center sm:text-left">
        <div className="section-label-card">{year === "2025_26" ? "2025/26" : "2026/27"}</div>
        <div className="font-currency mt-2 text-2xl font-semibold tabular-nums text-[var(--c-text)] sm:text-3xl">
          {formatMoneyGBP(total)}
        </div>
      </div>
    </div>
  );
}
