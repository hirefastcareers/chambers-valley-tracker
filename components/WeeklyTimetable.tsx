"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { formatMoneyGBP } from "@/lib/format";
import { addDaysToYmd, formatWeekCommencingLabel } from "@/lib/dashboardWeek";
import { formatWeekDashboardHeaderRange } from "@/lib/ukTaxYearWeeks";
import type { JobStatus } from "@/lib/status";
import { statusColorVar } from "@/lib/status";
import { cn } from "@/lib/cn";

export type TimetableJob = {
  id: number;
  customer_id: number;
  customer_name: string;
  job_type: string;
  status: JobStatus;
  quote_amount: string | number | null;
  date: string;
  time_of_day: "am" | "pm" | "all_day" | null;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SLOTS = [
  { key: "am", label: "AM" },
  { key: "pm", label: "PM" },
  { key: "all_day", label: "Day" },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];

function dayIndexFromYmd(ymd: string): number {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(ymd.trim());
  if (!m) return -1;
  const sun0 = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return sun0 === 0 ? 6 : sun0 - 1;
}

function dayNumberFromYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(ymd.trim());
  if (!m) return "";
  return String(Number(m[3]));
}

function slotForJob(timeOfDay: TimetableJob["time_of_day"]): SlotKey {
  if (timeOfDay === "pm") return "pm";
  if (timeOfDay === "all_day") return "all_day";
  return "am";
}

function statusBorderVar(status: JobStatus): string {
  return `var(${statusColorVar(status)})`;
}

export default function WeeklyTimetable({
  weekMonday,
  weekSunday,
  londonTodayYmd,
  jobs,
}: {
  weekMonday: string;
  weekSunday: string;
  londonTodayYmd: string;
  jobs: TimetableJob[];
}) {
  const router = useRouter();
  const dayYmids = Array.from({ length: 7 }, (_, i) => addDaysToYmd(weekMonday, i));

  const grid: Record<SlotKey, TimetableJob[][]> = {
    am: Array.from({ length: 7 }, () => [] as TimetableJob[]),
    pm: Array.from({ length: 7 }, () => [] as TimetableJob[]),
    all_day: Array.from({ length: 7 }, () => [] as TimetableJob[]),
  };

  for (const job of jobs) {
    const di = dayIndexFromYmd(job.date);
    if (di < 0 || di > 6) continue;
    const slot = slotForJob(job.time_of_day);
    grid[slot][di]!.push(job);
  }

  function goWeek(delta: number) {
    const next = addDaysToYmd(weekMonday, delta * 7);
    router.push(`/timetable?week=${next}`);
  }

  const visibleSlots = SLOTS.filter(
    (slot) => slot.key !== "all_day" || grid.all_day.some((cell) => cell.length > 0)
  );
  const rangeLabel = formatWeekDashboardHeaderRange(weekMonday, weekSunday);
  const wcLabel = formatWeekCommencingLabel(weekMonday);
  const weekTotal = jobs.reduce((sum, job) => {
    const raw = job.quote_amount;
    const n = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const weekTotalLabel = formatMoneyGBP(weekTotal);

  return (
    <div className="timetable-page flex min-h-0 flex-1 flex-col">
      <PageHeader className="timetable-header !mb-2 shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => goWeek(-1)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--c-border-strong)] bg-[var(--c-surface)] text-[var(--c-text)] touch-manipulation active:opacity-80"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[15px] font-semibold text-[var(--c-text)]">
              {wcLabel || "This week"}
            </div>
            <div className="truncate text-[12px] text-[var(--c-text-muted)] tabular-nums">{rangeLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => goWeek(1)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--c-border-strong)] bg-[var(--c-surface)] text-[var(--c-text)] touch-manipulation active:opacity-80"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <Link
            href="/"
            className="ml-1 shrink-0 text-[13px] font-medium text-[var(--c-text-muted)] touch-manipulation active:opacity-80"
          >
            Done
          </Link>
        </div>
        <div
          className="timetable-week-total"
          aria-label={`Week total ${weekTotalLabel}`}
        >
          <span className="timetable-week-total-label">Week total</span>
          <span className="timetable-week-total-amount font-currency tabular-nums">
            {weekTotalLabel}
          </span>
        </div>
      </PageHeader>

      <div className="timetable-rotate-hint mb-3 flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[var(--c-border-strong)] bg-[var(--c-surface)] px-3 py-2 text-[12px] text-[var(--c-text-muted)]">
        <RotateCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Rotate to landscape for the full week at a glance
      </div>

      <div className="timetable-scroll min-h-0 flex-1 overflow-auto">
        <div
          className="timetable-grid"
          role="grid"
          aria-label={`Week timetable ${rangeLabel}`}
        >
          <div className="timetable-corner" aria-hidden />
          {dayYmids.map((ymd, i) => {
            const isToday = ymd === londonTodayYmd;
            return (
              <div
                key={ymd}
                role="columnheader"
                className={cn("timetable-day-head", isToday && "is-today")}
              >
                <span className="timetable-day-name">{DAY_LABELS[i]}</span>
                <span className="timetable-day-num tabular-nums">{dayNumberFromYmd(ymd)}</span>
              </div>
            );
          })}

          {visibleSlots.map((slot) => (
            <div key={slot.key} className="timetable-slot-contents contents">
              <div role="rowheader" className="timetable-slot-label">
                {slot.label}
              </div>
              {dayYmids.map((ymd, di) => {
                const cellJobs = grid[slot.key][di]!;
                const isToday = ymd === londonTodayYmd;
                return (
                  <div
                    key={`${slot.key}-${ymd}`}
                    role="gridcell"
                    className={cn("timetable-cell", isToday && "is-today")}
                  >
                    {cellJobs.length === 0 ? (
                      <span className="timetable-empty" aria-hidden>
                        —
                      </span>
                    ) : (
                      cellJobs.map((job) => (
                        <Link
                          key={job.id}
                          href={`/customers/${job.customer_id}?job_id=${job.id}`}
                          className="timetable-job"
                          style={{ borderLeftColor: statusBorderVar(job.status) }}
                          title={`${job.customer_name} · ${job.job_type}`}
                        >
                          <span className="timetable-job-name">{job.customer_name}</span>
                          <span className="timetable-job-meta">{job.job_type}</span>
                          <span className="timetable-job-amount font-currency">
                            {formatMoneyGBP(job.quote_amount)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
