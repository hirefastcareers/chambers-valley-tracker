"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Calendar } from "lucide-react";
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
  is_recurring?: boolean;
  recurring_interval_weeks?: number | null;
  isOverdue: boolean;
};

/** `YYYY-MM-DD` from DB / ISO string; pads month & day for lexicographic compare. */
function normalizeCalendarYmd(input: string): string {
  if (!input || typeof input !== "string") return "";
  const part = (input.includes("T") ? input.split("T")[0]! : input.slice(0, 10)).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(part);
  if (!m) return "";
  return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
}

/** London calendar `YYYY-MM-DD` on the client (Europe/London). */
function londonTodayYmdFromClock(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !mo || !day) return "";
  return `${y}-${mo.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Past scheduled date (London) and not completed — show Overdue chip. */
function isOverdueJob(item: UpcomingJobItem, londonTodayYmd: string): boolean {
  if (item.status === "completed") return false;
  const ymd = normalizeCalendarYmd(item.date);
  const london = normalizeCalendarYmd(londonTodayYmd);
  if (!ymd || !london) return false;
  return ymd < london;
}

export default function DashboardUpcomingSection({
  initialItems,
  weeklyEarnings,
  mileageSummary,
}: {
  initialItems: UpcomingJobItem[];
  weeklyEarnings: WeeklyEarningsSummary;
  mileageSummary: { weekMiles: number; taxYearMiles: number } | null;
}) {
  const londonTodayYmd = useMemo(() => londonTodayYmdFromClock(), []);
  const items = initialItems;

  useEffect(() => {
    const geo = initialItems.find((i) => /geo\s*supplies/i.test(i.customer_name));
    if (!geo) return;
    const dateYmd = normalizeCalendarYmd(geo.date);
    const overdue = isOverdueJob(geo, londonTodayYmd);
    console.info("[dashboard-upcoming] GEO Supplies overdue check", {
      dateRaw: geo.date,
      dateYmd,
      londonTodayYmd,
      status: geo.status,
      isOverdue: overdue,
    });
  }, [initialItems, londonTodayYmd]);

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

      {mileageSummary ? (
        <Link
          href="/earnings"
          className="px-4 py-2 border-b border-[var(--c-border)] flex items-center justify-between gap-3 text-[11px] text-[var(--c-text-subtle)]"
        >
          <span className="truncate">🚗 {mileageSummary.weekMiles.toFixed(1)} miles this week</span>
          <span className="shrink-0">🚗 {mileageSummary.taxYearMiles.toFixed(1)} miles this tax year</span>
        </Link>
      ) : null}

      <div className="p-4 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-10 text-center text-[13px] text-[var(--c-text-muted)]">
            <div className="flex justify-center mb-3 text-[var(--c-text-muted)]" aria-hidden>
              <Calendar className="h-8 w-8 stroke-[1.5]" />
            </div>
            No jobs scheduled this week
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
                <div className="text-[13px] text-[var(--c-text-muted)] mt-2 inline-flex items-center gap-1">
                  {item.job_type}
                  {item.is_recurring ? <span aria-label="Recurring job">🔁</span> : null}
                </div>
                <div className="text-[13px] text-[var(--c-text-muted)] mt-2 flex flex-wrap items-center gap-0">
                  <span>
                    {formatDateDDMMYYYY(item.date)}
                    {item.time_of_day === "am" ? " · AM" : item.time_of_day === "pm" ? " · PM" : ""}
                  </span>
                  {isOverdueJob(item, londonTodayYmd) ? (
                    <span
                      style={{
                        background: "#fee2e2",
                        color: "#dc2626",
                        borderRadius: "20px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        marginLeft: "6px",
                      }}
                    >
                      Overdue
                    </span>
                  ) : null}
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
