"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import StatusIndicator from "@/components/StatusIndicator";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import type { JobStatus } from "@/lib/status";
import type { WeeklyEarningsSummary } from "@/lib/weeklyEarnings";

export type UpcomingJobItem = {
  id: number;
  customer_id: number;
  customer_name: string;
  job_type: string;
  status: JobStatus;
  quote_amount: string | number | null;
  date: string;
  time_of_day: "am" | "pm" | "all_day" | null;
};

function sortByDateAsc(items: UpcomingJobItem[]) {
  return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function DashboardUpcomingSection({
  initialItems,
  weeklyEarnings,
}: {
  initialItems: UpcomingJobItem[];
  weeklyEarnings: WeeklyEarningsSummary;
}) {
  const [items, setItems] = useState<UpcomingJobItem[]>(sortByDateAsc(initialItems));

  useEffect(() => {
    setItems(sortByDateAsc(initialItems));
  }, [initialItems]);

  const headerRight = useMemo(() => {
    if (weeklyEarnings.showAmountInHeader && weeklyEarnings.headerAmountFormatted) {
      return `${weeklyEarnings.weekRangeLabel} · ${weeklyEarnings.headerAmountFormatted}`;
    }
    return weeklyEarnings.weekRangeLabel;
  }, [weeklyEarnings]);

  const earnedStr = formatMoneyGBP(weeklyEarnings.earned);
  const potentialStr = formatMoneyGBP(weeklyEarnings.potential);

  return (
    <Card>
      <div className="px-4 pt-6 pb-4 border-b border-[var(--c-border)]">
        <div className="flex items-center justify-between gap-3">
          <div className="section-label-card !mt-0 !mb-0 shrink-0">UPCOMING JOBS</div>
          <div
            className="text-right truncate min-w-0"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--c-text-muted)",
            }}
          >
            {headerRight}
          </div>
        </div>

        <div
          className="mt-3 w-full overflow-hidden bg-[var(--c-border)]"
          style={{ height: 6, borderRadius: 3 }}
        >
          <div className="flex h-full w-full overflow-hidden rounded-[3px]">
            {weeklyEarnings.greenWidthPercent > 0 ? (
              <div
                className="h-full shrink-0"
                style={{
                  width: `${weeklyEarnings.greenWidthPercent}%`,
                  background: "#16a34a",
                  transition: "width 0.4s ease",
                }}
              />
            ) : null}
            {weeklyEarnings.amberWidthPercent > 0 ? (
              <div
                className="h-full shrink-0"
                style={{
                  width: `${weeklyEarnings.amberWidthPercent}%`,
                  background: "#d97706",
                  transition: "width 0.4s ease",
                }}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-1.5 flex items-start justify-between gap-2 text-[11px]">
          <span className="min-w-0">
            <span style={{ color: "#16a34a" }}>{earnedStr} earned</span>
            <span className="text-[var(--c-text-subtle)]"> · </span>
            <span style={{ color: "#d97706" }}>{potentialStr} potential</span>
          </span>
          {weeklyEarnings.targetMet ? (
            <span className="shrink-0 font-medium" style={{ color: "#16a34a" }}>
              Target met 🎯
            </span>
          ) : (
            <span className="shrink-0 tabular-nums text-[var(--c-text-subtle)]">
              {weeklyEarnings.percentOfTargetLine}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-10 text-center text-[13px] text-[var(--c-text-muted)]">
            No upcoming jobs in this list
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={`job-${item.id}`}
              href={`/customers/${item.customer_id}?job_id=${item.id}`}
              className="relative flex items-start justify-between gap-3 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-5 cursor-pointer clickable-card"
              aria-label={`Open customer ${item.customer_name} for job ${item.job_type}`}
            >
              <div className="min-w-0 pr-2">
                <div className="font-semibold text-[15px] text-[var(--c-text)] truncate">{item.customer_name}</div>
                <div className="text-[13px] text-[var(--c-text-muted)] mt-2">{item.job_type}</div>
                <div className="text-[13px] text-[var(--c-text-muted)] mt-2">
                  {formatDateDDMMYYYY(item.date)}
                  {item.time_of_day === "am" ? " · AM" : item.time_of_day === "pm" ? " · PM" : ""}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                <StatusIndicator status={item.status} />
                <div className="font-currency text-[17px] text-[var(--c-text)]">{formatMoneyGBP(item.quote_amount)}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
