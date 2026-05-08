"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  APIProvider,
  ColorScheme,
  InfoWindow,
  Map,
  Marker,
  useMap,
} from "@vis.gl/react-google-maps";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  defaultCarouselWeekStart,
  enumerateTaxWeeksMonSun,
  formatWeekDashboardHeaderRange,
  formatWeekOfMonthChipLabel,
  mondayYmdForToday,
} from "@/lib/ukTaxYearWeeks";

/** S35 / Chapeltown area default centre when geolocation is unavailable. */
const DEFAULT_CENTER = { lat: 53.47, lng: -1.47 } as const;
const DEFAULT_ZOOM = 13;

/** Monday-first: Mon..Sun — matches date_parts weekday index (0 = Monday). */
const DAY_BG: string[] = [
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#f97316",
  "#6b7280",
];

const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type JobPin = {
  job_id: number;
  customer_id: number;
  customer_name: string;
  job_type: string;
  date_done: string;
  time_of_day: string | null;
  quote_amount: string | number | null;
  latitude: number;
  longitude: number;
};

function weekdayIndexMondayFirst(dateYmd: string): number {
  const [y, m, d] = dateYmd.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  const sun0 = dt.getDay();
  return sun0 === 0 ? 6 : sun0 - 1;
}

function circleMarkerUrl(bg: string, letter: string): string {
  const esc = letter.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
<circle cx="12" cy="12" r="11" fill="${bg}" stroke="rgba(255,255,255,0.9)" stroke-width="1"/>
<text x="12" y="12" dominant-baseline="central" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="11" font-weight="700">${esc}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatTimeSlot(t: string | null | undefined): string {
  if (t === "am") return "AM";
  if (t === "pm") return "PM";
  if (t === "all_day") return "All day";
  return "";
}

type WeekChip = { week_start: string; week_end: string };

function chipId(weekStart: string) {
  return `map-week-chip-${weekStart}`;
}

/** Pans the map when default center changes (e.g. geolocation). */
function MapPanOnCenter({ center }: { center: google.maps.LatLngLiteral }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo(center);
  }, [map, center.lat, center.lng]);
  return null;
}

export default function JobMapPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

  const weeksTemplate = useMemo((): WeekChip[] => enumerateTaxWeeksMonSun(), []);
  const weeksNewestFirst = useMemo(() => [...weeksTemplate].reverse(), [weeksTemplate]);
  const chronological = useMemo(() => [...weeksNewestFirst].reverse(), [weeksNewestFirst]);

  const initialWeekStart = useMemo(() => {
    return (
      defaultCarouselWeekStart(weeksNewestFirst.map((w) => ({ week_start: w.week_start }))) ||
      mondayYmdForToday()
    );
  }, [weeksNewestFirst]);

  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(initialWeekStart);
  const [jobs, setJobs] = useState<JobPin[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingJobs(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/map/jobs?week_start=${encodeURIComponent(selectedWeekStart)}`);
        const data = await res.json();
        if (!res.ok || !data?.ok || !Array.isArray(data.jobs)) {
          throw new Error(data?.error ?? "Failed to load map jobs");
        }
        if (!cancelled) {
          setJobs(data.jobs as JobPin[]);
        }
      } catch (e) {
        if (!cancelled) {
          setJobs([]);
          setLoadError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedWeekStart]);

  const selectedJob = useMemo(
    () => (selectedJobId === null ? null : jobs.find((j) => j.job_id === selectedJobId) ?? null),
    [jobs, selectedJobId]
  );

  const legendDays = useMemo(() => {
    const set = new Set<number>();
    for (const j of jobs) {
      set.add(weekdayIndexMondayFirst(j.date_done));
    }
    return Array.from(set)
      .sort((a, b) => a - b)
      .map((idx) => ({ idx, name: DAY_NAMES[idx], color: DAY_BG[idx]! }));
  }, [jobs]);

  useLayoutEffect(() => {
    if (!selectedWeekStart || initialScrollDoneRef.current) return;
    const el = document.getElementById(chipId(selectedWeekStart));
    if (!el) return;
    initialScrollDoneRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedWeekStart]);

  const focusChip = useCallback((weekStart: string) => {
    setSelectedWeekStart(weekStart);
    requestAnimationFrame(() => {
      document.getElementById(chipId(weekStart))?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  }, []);

  const selectedChronoIndex = useMemo(
    () => chronological.findIndex((w) => w.week_start === selectedWeekStart),
    [chronological, selectedWeekStart]
  );

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

  const showEmptyOverlay = !loadingJobs && !loadError && jobs.length === 0;

  if (!apiKey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <p className="text-[15px] text-[var(--c-text-muted)]">Map is unavailable: set NEXT_PUBLIC_GOOGLE_PLACES_API_KEY.</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col -mx-4 flex-1 min-h-0"
      style={{ height: "calc(100dvh - var(--nav-padding-bottom))", maxHeight: "calc(100dvh - var(--nav-padding-bottom))" }}
    >
      <div className="shrink-0 px-4 pt-2 pb-2">
        {loadError ? <p className="text-sm text-[var(--c-text-muted)]">{loadError}</p> : null}
        {weeksNewestFirst.length > 0 ? (
          <div className="flex max-h-[70px] items-center gap-2">
            <button
              type="button"
              aria-label="Previous week"
              disabled={selectedChronoIndex <= 0}
              onClick={() => stepWeek(-1)}
              className="flex h-[70px] max-h-[70px] w-9 shrink-0 items-center justify-center rounded-[10px] border border-solid border-[var(--c-border)] bg-white text-xl leading-none text-[var(--c-text)] touch-manipulation disabled:pointer-events-none disabled:opacity-35"
            >
              ‹
            </button>
            <div
              ref={scrollerRef}
              className={cn(
                "flex max-h-[70px] min-h-0 min-w-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden scroll-smooth",
                "snap-x snap-mandatory",
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              )}
            >
              {chronological.map((w) => {
                const isSelected = w.week_start === selectedWeekStart;
                return (
                  <button
                    key={w.week_start}
                    id={chipId(w.week_start)}
                    type="button"
                    onClick={() => onChipClick(w.week_start)}
                    className={cn(
                      "snap-center shrink-0 text-center",
                      "max-h-[70px] min-h-0 min-w-[100px] rounded-[10px] border border-solid px-3 py-2 touch-manipulation",
                      "flex flex-col items-center justify-center gap-0.5 leading-none",
                      isSelected
                        ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                        : "border-[var(--c-border)] bg-white text-[var(--c-text)]"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[12px] font-medium leading-tight",
                        isSelected ? "text-[rgba(255,255,255,0.7)]" : "text-[var(--c-text-subtle)]"
                      )}
                    >
                      {formatWeekOfMonthChipLabel(w.week_start)}
                    </span>
                    <span
                      className={cn(
                        "text-[13px] font-medium leading-tight",
                        isSelected ? "text-white" : "text-[var(--c-text)]"
                      )}
                    >
                      {formatWeekDashboardHeaderRange(w.week_start, w.week_end)}
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
              className="flex h-[70px] max-h-[70px] w-9 shrink-0 items-center justify-center rounded-[10px] border border-solid border-[var(--c-border)] bg-white text-xl leading-none text-[var(--c-text)] touch-manipulation disabled:pointer-events-none disabled:opacity-35"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative flex-1 min-h-0 w-screen max-w-[100vw] left-1/2 -translate-x-1/2">
        <APIProvider apiKey={apiKey}>
          <Map
            className="h-full w-full"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            gestureHandling="greedy"
            colorScheme={ColorScheme.DARK}
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
          >
            <MapPanOnCenter center={mapCenter} />
            {jobs.map((j) => {
              const di = weekdayIndexMondayFirst(j.date_done);
              const bg = DAY_BG[di] ?? "#6b7280";
              const letter = DAY_INITIALS[di] ?? "?";
              const pos = { lat: j.latitude, lng: j.longitude };
              return (
                <Marker
                  key={j.job_id}
                  position={pos}
                  onClick={() => setSelectedJobId(j.job_id)}
                  icon={
                    {
                      url: circleMarkerUrl(bg, letter),
                      scaledSize: { width: 24, height: 24 },
                      anchor: { x: 12, y: 12 },
                    } as google.maps.Icon
                  }
                />
              );
            })}

            {selectedJob ? (
              <InfoWindow
                position={{ lat: selectedJob.latitude, lng: selectedJob.longitude }}
                pixelOffset={[0, -8]}
                onCloseClick={() => setSelectedJobId(null)}
              >
                <div
                  className="min-w-[200px] max-w-[240px] rounded-[12px] border border-[var(--c-border-strong)] bg-white p-3 text-[13px] text-[var(--c-text)] shadow-sm"
                  style={{ color: "var(--c-text)", fontFamily: "system-ui, sans-serif" }}
                >
                  <div className="font-bold text-[15px]">{selectedJob.customer_name}</div>
                  <div className="mt-1 text-[13px] opacity-90">{selectedJob.job_type}</div>
                  <div className="mt-2 text-[12px] opacity-80">
                    {formatDateDDMMYYYY(selectedJob.date_done)}
                    {(() => {
                      const slot = formatTimeSlot(selectedJob.time_of_day);
                      return slot ? ` · ${slot}` : "";
                    })()}
                  </div>
                  {selectedJob.quote_amount != null && String(selectedJob.quote_amount).trim() !== "" ? (
                    <div className="mt-2 font-currency text-[14px] font-semibold">
                      {formatMoneyGBP(selectedJob.quote_amount)}
                    </div>
                  ) : null}
                  <Link
                    href={`/customers/${selectedJob.customer_id}`}
                    className="mt-3 inline-block text-[13px] font-semibold text-[var(--c-info)] underline"
                    onClick={() => setSelectedJobId(null)}
                  >
                    View customer
                  </Link>
                </div>
              </InfoWindow>
            ) : null}
          </Map>
        </APIProvider>

        {legendDays.length > 0 ? (
          <div
            className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-[10px] px-3 py-2"
            style={{ background: "rgba(255,255,255,0.88)", border: "1px solid var(--c-border)" }}
          >
            <div className="pointer-events-auto flex flex-col gap-1.5">
              {legendDays.map(({ idx, name, color }) => (
                <div key={idx} className="flex items-center gap-2 text-[12px] text-[var(--c-text)]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showEmptyOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center px-4">
            <div className="rounded-[12px] border border-[var(--c-border-strong)] bg-white/95 px-4 py-3 text-center shadow-md">
              <p className="text-[14px] font-medium text-[var(--c-text)]">
                No mapped jobs this week — coordinates may still be loading
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
