"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import {
  formatWeekRangeLabel,
  mondayYmdForToday,
  parseYmdLocal,
  ukTaxYearLabelForDate,
} from "@/lib/ukTaxYearWeeks";
import { cn } from "@/lib/cn";

type WeekJob = {
  id: number;
  customer_name: string;
  job_type: string;
  date_done: string;
  quote_amount: number;
};

type WeekRow = {
  week_start: string;
  week_end: string;
  total: number;
  jobs: WeekJob[];
};

function pickDefaultWeekStart(weeks: WeekRow[]): string {
  const todayMon = mondayYmdForToday();
  const firstWith = weeks.find((w) => w.total > 0);
  if (firstWith) return firstWith.week_start;
  const cur = weeks.find((w) => w.week_start === todayMon);
  if (cur) return cur.week_start;
  return weeks[0]?.week_start ?? "";
}

function groupWeeksByTaxYear(weeks: WeekRow[]): { label: string; items: WeekRow[] }[] {
  const groups: { label: string; items: WeekRow[] }[] = [];
  for (const w of weeks) {
    const end = parseYmdLocal(w.week_end);
    const label = ukTaxYearLabelForDate(end);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(w);
    else groups.push({ label, items: [w] });
  }
  return groups;
}

export default function WeeklyEarningsBreakdown() {
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/earnings/weekly");
        const data = await res.json();
        if (!res.ok || !data?.ok || !Array.isArray(data.weeks)) {
          throw new Error(data?.error ?? "Failed to load weekly earnings");
        }
        if (cancelled) return;
        const list = data.weeks as WeekRow[];
        setWeeks(list);
        setSelectedWeekStart((prev) => prev ?? pickDefaultWeekStart(list));
        setLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
          setWeeks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const todayMonday = useMemo(() => mondayYmdForToday(), []);

  const selected = useMemo(
    () => weeks.find((w) => w.week_start === selectedWeekStart) ?? null,
    [weeks, selectedWeekStart]
  );

  const grouped = useMemo(() => groupWeeksByTaxYear(weeks), [weeks]);

  const triggerLabel = useMemo(() => {
    if (!selected) return loading ? "Loading…" : "Select week";
    const range = formatWeekRangeLabel(selected.week_start, selected.week_end);
    return `${range} \u00b7 ${formatMoneyGBP(selected.total)}`;
  }, [selected, loading]);

  const onSelectWeek = useCallback((weekStart: string) => {
    setSelectedWeekStart(weekStart);
    setOpen(false);
  }, []);

  return (
    <div ref={rootRef} className="relative mt-3">
      {loadError ? (
        <p className="text-sm text-[var(--c-text-muted)]">{loadError}</p>
      ) : null}

      <button
        type="button"
        disabled={loading || weeks.length === 0}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "w-full flex items-center justify-between gap-3 text-left rounded-[10px] border border-solid border-[var(--c-border)] bg-white px-4 py-3 text-[15px] text-[var(--c-text)] touch-manipulation",
          (loading || weeks.length === 0) && "opacity-60"
        )}
      >
        <span className="min-w-0 flex-1 truncate font-normal">{triggerLabel}</span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-[var(--c-text-muted)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && weeks.length > 0 ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(60vh,420px)] overflow-y-auto rounded-[10px] border border-solid border-[var(--c-border)] bg-white shadow-lg"
          role="listbox"
          aria-label="Select week"
        >
          {grouped.map((g) => (
            <div key={g.label}>
              <div
                className="sticky top-0 z-10 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-xs font-semibold text-[var(--c-text-muted)]"
                style={{ background: "var(--c-surface)" }}
              >
                {g.label}
              </div>
              {g.items.map((w) => {
                const isSelected = w.week_start === selectedWeekStart;
                const isThisWeek = w.week_start === todayMonday;
                return (
                  <button
                    key={w.week_start}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onSelectWeek(w.week_start)}
                    className={cn(
                      "flex w-full items-center gap-2 border-b border-[var(--c-border)] px-4 py-3 text-left text-[15px] last:border-b-0 touch-manipulation",
                      isSelected && "bg-[#f5f5f5]",
                      isThisWeek && !isSelected && "bg-[#f0fdf4]"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[var(--c-text)]">
                          {formatWeekRangeLabel(w.week_start, w.week_end)}
                        </span>
                        {isThisWeek ? (
                          <span className="inline-flex shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                            This week
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="shrink-0 font-currency tabular-nums text-[var(--c-text-muted)]">
                      {formatMoneyGBP(w.total)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {!loading && selected ? (
          selected.jobs.length === 0 ? (
            <p className="text-sm text-[var(--c-text-muted)]">No completed jobs this week</p>
          ) : (
            <div className="flex flex-col">
              {selected.jobs.map((job, idx) => (
                <div
                  key={job.id}
                  className={cn(
                    "flex items-start justify-between gap-3 py-3",
                    idx > 0 && "border-t border-solid border-[var(--c-border)]"
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-[var(--c-text)]">{job.customer_name}</div>
                    <div className="mt-0.5 text-sm text-[var(--c-text-muted)]">{job.job_type}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-currency text-[15px] font-semibold tabular-nums text-[var(--c-text)]">
                      {formatMoneyGBP(job.quote_amount)}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--c-text-subtle)]">
                      {formatDateDDMMYYYY(job.date_done)}
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-2 flex justify-end border-t border-solid border-[var(--c-border)] pt-3">
                <span className="text-[15px] font-semibold text-[var(--c-text)]">
                  Week total:{" "}
                  <span className="font-currency tabular-nums">{formatMoneyGBP(selected.total)}</span>
                </span>
              </div>
            </div>
          )
        ) : loading ? (
          <p className="text-sm text-[var(--c-text-muted)]">Loading weekly breakdown…</p>
        ) : null}
      </div>
    </div>
  );
}
