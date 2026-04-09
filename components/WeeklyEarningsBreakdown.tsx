"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatDateDDMMYYYY, formatMoneyGBP, formatMoneyWeeklyChip } from "@/lib/format";
import { defaultCarouselWeekStart, formatWeekChipShortRange } from "@/lib/ukTaxYearWeeks";
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

function chipId(weekStart: string) {
  return `week-chip-${weekStart}`;
}

export default function WeeklyEarningsBreakdown() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const scrollSyncTimerRef = useRef<number | null>(null);
  const skipScrollSyncRef = useRef(false);

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);

  const chronological = useMemo(() => [...weeks].reverse(), [weeks]);

  const syncSelectionFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || chronological.length === 0) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let bestKey: string | null = null;
    let bestDist = Infinity;
    for (const w of chronological) {
      const chip = document.getElementById(chipId(w.week_start));
      if (!chip) continue;
      const r = chip.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = Math.abs(cx - centerX);
      if (d < bestDist) {
        bestDist = d;
        bestKey = w.week_start;
      }
    }
    if (bestKey) setSelectedWeekStart(bestKey);
  }, [chronological]);

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
        setSelectedWeekStart(defaultCarouselWeekStart(list));
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

  useLayoutEffect(() => {
    if (loading || weeks.length === 0 || !selectedWeekStart || initialScrollDoneRef.current) return;
    const el = document.getElementById(chipId(selectedWeekStart));
    if (!el) return;
    initialScrollDoneRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [loading, weeks.length, selectedWeekStart]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const flushSync = () => {
      if (scrollSyncTimerRef.current !== null) {
        window.clearTimeout(scrollSyncTimerRef.current);
        scrollSyncTimerRef.current = null;
      }
      if (!skipScrollSyncRef.current) syncSelectionFromScroll();
    };

    const onScrollEnd = () => {
      if (!skipScrollSyncRef.current) syncSelectionFromScroll();
    };

    const onScroll = () => {
      if (skipScrollSyncRef.current) return;
      if (scrollSyncTimerRef.current !== null) window.clearTimeout(scrollSyncTimerRef.current);
      scrollSyncTimerRef.current = window.setTimeout(flushSync, 150);
    };

    el.addEventListener("scrollend", onScrollEnd);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scrollend", onScrollEnd);
      el.removeEventListener("scroll", onScroll);
      if (scrollSyncTimerRef.current !== null) window.clearTimeout(scrollSyncTimerRef.current);
    };
  }, [syncSelectionFromScroll]);

  const selected = useMemo(
    () => weeks.find((w) => w.week_start === selectedWeekStart) ?? null,
    [weeks, selectedWeekStart]
  );

  const selectedChronoIndex = useMemo(
    () => chronological.findIndex((w) => w.week_start === selectedWeekStart),
    [chronological, selectedWeekStart]
  );

  const focusChip = useCallback((weekStart: string) => {
    skipScrollSyncRef.current = true;
    setSelectedWeekStart(weekStart);
    requestAnimationFrame(() => {
      document.getElementById(chipId(weekStart))?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
      window.setTimeout(() => {
        skipScrollSyncRef.current = false;
      }, 450);
    });
  }, []);

  const stepWeek = useCallback(
    (delta: number) => {
      const idx = selectedChronoIndex;
      if (idx < 0) return;
      const n = idx + delta;
      if (n < 0 || n >= chronological.length) return;
      focusChip(chronological[n]!.week_start);
    },
    [chronological, focusChip, selectedChronoIndex]
  );

  const onChipClick = useCallback(
    (weekStart: string) => {
      if (weekStart === selectedWeekStart) return;
      focusChip(weekStart);
    },
    [focusChip, selectedWeekStart]
  );

  return (
    <div className="relative z-0 mt-3">
      {loadError ? (
        <p className="text-sm text-[var(--c-text-muted)]">{loadError}</p>
      ) : null}

      {!loading && weeks.length > 0 ? (
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            aria-label="Previous week"
            disabled={selectedChronoIndex <= 0}
            onClick={() => stepWeek(-1)}
            className="flex h-auto min-h-[72px] w-9 shrink-0 items-center justify-center self-center rounded-[10px] border border-solid border-[var(--c-border)] bg-white text-xl leading-none text-[var(--c-text)] touch-manipulation disabled:pointer-events-none disabled:opacity-35"
          >
            ‹
          </button>

          <div
            ref={scrollerRef}
            className={cn(
              "flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth py-1",
              "snap-x snap-mandatory",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            )}
            style={{ scrollBehavior: "smooth" }}
          >
            {chronological.map((w) => {
              const isSelected = w.week_start === selectedWeekStart;
              const hasEarnings = w.total > 0;
              return (
                <button
                  key={w.week_start}
                  id={chipId(w.week_start)}
                  type="button"
                  data-week-start={w.week_start}
                  onClick={() => onChipClick(w.week_start)}
                  className={cn(
                    "snap-center shrink-0 text-center",
                    "min-w-[100px] rounded-[10px] border border-solid px-[14px] py-[10px] touch-manipulation",
                    "flex flex-col items-center justify-center",
                    isSelected
                      ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                      : "border-[var(--c-border)] bg-white text-[var(--c-text)]"
                  )}
                >
                  <span
                    className={cn(
                      "text-[13px] font-medium leading-tight",
                      isSelected ? "text-white" : "text-[var(--c-text)]"
                    )}
                  >
                    {formatWeekChipShortRange(w.week_start, w.week_end)}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-[13px] font-currency tabular-nums leading-tight",
                      isSelected
                        ? "text-white/85"
                        : hasEarnings
                          ? "text-[var(--c-text-muted)]"
                          : "text-[var(--c-text-subtle)]"
                    )}
                  >
                    {formatMoneyWeeklyChip(w.total)}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Next week"
            disabled={selectedChronoIndex < 0 || selectedChronoIndex >= chronological.length - 1}
            onClick={() => stepWeek(1)}
            className="flex h-auto min-h-[72px] w-9 shrink-0 items-center justify-center self-center rounded-[10px] border border-solid border-[var(--c-border)] bg-white text-xl leading-none text-[var(--c-text)] touch-manipulation disabled:pointer-events-none disabled:opacity-35"
          >
            ›
          </button>
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
