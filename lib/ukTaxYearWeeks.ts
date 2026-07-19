import { format, isValid } from "date-fns";
import { enGB } from "date-fns/locale";

/** UK tax years for weekly earnings: 2025/26 and 2026/27 (6 Apr 2025 – 5 Apr 2027). */
export const WEEKLY_EARNINGS_RANGE = {
  firstTaxDay: { y: 2025, m: 4, d: 6 },
  lastTaxDay: { y: 2027, m: 4, d: 5 },
} as const;

export function toYmdLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmdLocal(ymd: string): Date {
  const part = ymd.split("T")[0] ?? "";
  const [y, m, d] = part.split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
}

/** Monday-start week (Mon–Sun) containing the given calendar day (local). */
export function getMondayOfDate(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  mon.setDate(mon.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getSundayAfterMonday(mon: Date): Date {
  return addDaysLocal(mon, 6);
}

export function enumerateTaxWeeksMonSun(): { week_start: string; week_end: string }[] {
  const { firstTaxDay, lastTaxDay } = WEEKLY_EARNINGS_RANGE;
  const rangeStart = new Date(firstTaxDay.y, firstTaxDay.m - 1, firstTaxDay.d);
  const rangeEnd = new Date(lastTaxDay.y, lastTaxDay.m - 1, lastTaxDay.d);
  let mon = getMondayOfDate(rangeStart);
  const lastMon = getMondayOfDate(rangeEnd);
  const out: { week_start: string; week_end: string }[] = [];
  while (mon.getTime() <= lastMon.getTime()) {
    const sun = getSundayAfterMonday(mon);
    out.push({ week_start: toYmdLocal(mon), week_end: toYmdLocal(sun) });
    mon = addDaysLocal(mon, 7);
  }
  return out;
}

/** Start year Y of the UK tax year (6 Apr Y – 5 Apr Y+1) that contains `now`. */
export function ukTaxYearStartYearForDate(now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  return m > 3 || (m === 3 && d >= 6) ? y : y - 1;
}

/**
 * Map week chips — a rolling window derived from `now` so the range never goes
 * stale (no hardcoded end date). Spans the previous tax year through the end of
 * the next tax year:
 *   start = 6 Apr (Y-1)  — start of the previous tax year, keeps recent history visible
 *   end   = 5 Apr (Y+2)  — end of the next tax year, always ≥12 months into the future
 * where Y is the start year of the tax year containing `now`.
 * Produces every Monday–Sunday week between those dates.
 */
export function enumerateMapWeeksMonSun(
  now: Date = new Date()
): { week_start: string; week_end: string }[] {
  const y = ukTaxYearStartYearForDate(now);
  const rangeStart = new Date(y - 1, 3, 6); // 6 Apr (Y-1)
  const rangeEnd = new Date(y + 2, 3, 5); // 5 Apr (Y+2)
  let mon = getMondayOfDate(rangeStart);
  const lastMon = getMondayOfDate(rangeEnd);
  const out: { week_start: string; week_end: string }[] = [];
  while (mon.getTime() <= lastMon.getTime()) {
    const sun = getSundayAfterMonday(mon);
    out.push({ week_start: toYmdLocal(mon), week_end: toYmdLocal(sun) });
    mon = addDaysLocal(mon, 7);
  }
  return out;
}

/** Inclusive calendar dates for paid jobs shown in weekly earnings (6 Apr 2025 – 5 Apr 2027). */
export function getJobQueryDateBounds(): { start: string; end: string } {
  const { firstTaxDay, lastTaxDay } = WEEKLY_EARNINGS_RANGE;
  return {
    start: toYmdLocal(new Date(firstTaxDay.y, firstTaxDay.m - 1, firstTaxDay.d)),
    end: toYmdLocal(new Date(lastTaxDay.y, lastTaxDay.m - 1, lastTaxDay.d)),
  };
}

/** Current UK tax year (6 Apr–5 Apr) as inclusive YYYY-MM-DD in local calendar. */
export function getUkTaxYearBoundsYmdForDate(now: Date): { start: string; end: string } {
  const year = now.getFullYear();
  const april6ThisYear = new Date(year, 3, 6);
  if (now.getTime() >= april6ThisYear.getTime()) {
    return { start: toYmdLocal(april6ThisYear), end: toYmdLocal(new Date(year + 1, 3, 5)) };
  }
  return { start: toYmdLocal(new Date(year - 1, 3, 6)), end: toYmdLocal(new Date(year, 3, 5)) };
}

/** Signed calendar-day difference using date-only UTC math (avoids DST edge cases). */
export function differenceLocalCalendarDays(from: Date, to: Date): number {
  const f = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const t = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((t - f) / 86400000);
}

/** e.g. 2025/26 — tax year containing this calendar date (6 Apr boundary). */
export function ukTaxYearLabelForDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const taxYearStartYear = m > 3 || (m === 3 && day >= 6) ? y : y - 1;
  const endYY = String(taxYearStartYear + 1).slice(-2);
  return `${taxYearStartYear}/${endYY}`;
}

export function formatWeekRangeLabel(weekStartYmd: string, weekEndYmd: string): string {
  const start = parseYmdLocal(weekStartYmd);
  const end = parseYmdLocal(weekEndYmd);
  if (!isValid(start) || !isValid(end)) return "—";
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "EEE d MMM", { locale: enGB })} \u2013 ${format(end, "EEE d MMM yyyy", { locale: enGB })}`;
  }
  return `${format(start, "EEE d MMM yyyy", { locale: enGB })} \u2013 ${format(end, "EEE d MMM yyyy", { locale: enGB })}`;
}

/** Short chip label e.g. 31 Mar – 6 Apr 2026 (day + month + year). */
export function formatWeekChipShortRange(weekStartYmd: string, weekEndYmd: string): string {
  const start = parseYmdLocal(weekStartYmd);
  const end = parseYmdLocal(weekEndYmd);
  if (!isValid(start) || !isValid(end)) return "—";
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d MMM", { locale: enGB })} \u2013 ${format(end, "d MMM yyyy", { locale: enGB })}`;
  }
  return `${format(start, "d MMM yyyy", { locale: enGB })} \u2013 ${format(end, "d MMM yyyy", { locale: enGB })}`;
}

/**
 * Dashboard / map chip date range with year for disambiguation.
 * Same calendar month → "4–10 May 2026"; across months → "28 Apr–4 May 2026";
 * across years → "29 Dec 2026–4 Jan 2027".
 */
export function formatWeekDashboardHeaderRange(weekStartYmd: string, weekEndYmd: string): string {
  const start = parseYmdLocal(weekStartYmd);
  const end = parseYmdLocal(weekEndYmd);
  if (!isValid(start) || !isValid(end)) return "—";
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${format(start, "d", { locale: enGB })}\u2013${format(end, "d MMM yyyy", { locale: enGB })}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d MMM", { locale: enGB })}\u2013${format(end, "d MMM yyyy", { locale: enGB })}`;
  }
  return `${format(start, "d MMM yyyy", { locale: enGB })}\u2013${format(end, "d MMM yyyy", { locale: enGB })}`;
}

/** Calendar month (year + 0–11) that owns the most Mon–Sun days; ties → chronologically later month. */
export function majorityCalendarMonthForWeek(weekStartYmd: string): { y: number; m: number } {
  const mon = parseYmdLocal(weekStartYmd);
  const tally = new Map<number, number>();
  for (let i = 0; i < 7; i++) {
    const d = addDaysLocal(mon, i);
    const key = d.getFullYear() * 12 + d.getMonth();
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let bestKey = 0;
  let bestCount = -1;
  for (const [k, c] of tally) {
    if (c > bestCount || (c === bestCount && k > bestKey)) {
      bestCount = c;
      bestKey = k;
    }
  }
  return { y: Math.floor(bestKey / 12), m: bestKey % 12 };
}

/**
 * Month used for “Wn Mon” chips: if the Mon–Sun week includes the 1st of a calendar month, that month
 * wins (e.g. 27 Apr–3 May contains 1 May → May). Otherwise use {@link majorityCalendarMonthForWeek}.
 * (At most one “1st” can appear in a single week.)
 */
export function chipLabelCalendarMonthForWeek(weekStartYmd: string): { y: number; m: number } {
  const mon = parseYmdLocal(weekStartYmd);
  for (let i = 0; i < 7; i++) {
    const d = addDaysLocal(mon, i);
    if (d.getDate() === 1) {
      return { y: d.getFullYear(), m: d.getMonth() };
    }
  }
  return majorityCalendarMonthForWeek(weekStartYmd);
}

/** `YYYY-MM` for the same calendar month as the earnings week chip (1st-in-week wins, else day majority). */
export function chipBudgetMonthYyyyMmFromWeekMonday(weekMondayYmd: string): string {
  const { y, m } = chipLabelCalendarMonthForWeek(weekMondayYmd);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m + 1)}`;
}

/** Monday `YYYY-MM-DD` of the Mon–Sun week containing `dateDoneYmd` (`YYYY-MM-DD` or ISO prefix). */
export function weekMondayYmdForDateDoneYmd(dateDoneYmd: string): string | null {
  const part = dateDoneYmd.split("T")[0]?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return null;
  return toYmdLocal(getMondayOfDate(parseYmdLocal(part)));
}

/** Sunday `YYYY-MM-DD` for the week that starts `weekMondayYmd` (Mon–Sun). */
export function weekSundayYmdFromWeekMonday(weekMondayYmd: string): string {
  return toYmdLocal(getSundayAfterMonday(parseYmdLocal(weekMondayYmd)));
}

/**
 * Week-of-month chip, e.g. W1 May.
 * Label month = month of the 1st if it falls in the week, else the month with the most days (tie → later).
 * Week number = 1 + whole weeks from the Monday of the week that contains the 1st of that month
 * to this week’s Monday (W1 is the week containing the 1st, including partial weeks).
 */
export function formatWeekOfMonthChipLabel(weekStartYmd: string, opts?: { includeYear?: boolean }): string {
  const chipMonday = parseYmdLocal(weekStartYmd);
  const { y, m } = chipLabelCalendarMonthForWeek(weekStartYmd);
  const firstOfMonth = new Date(y, m, 1);
  const anchorMonday = getMondayOfDate(firstOfMonth);
  const diffDays = differenceLocalCalendarDays(anchorMonday, chipMonday);
  const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
  const monthAbbr = format(new Date(y, m, 1), "MMM", { locale: enGB });
  const base = `W${weekNum} ${monthAbbr}`;
  return opts?.includeYear ? `${base} ${y}` : base;
}

/** Full title line with year: e.g. W2 Apr 2028 · Mon 3 Apr – Sun 9 Apr 2028. */
export function formatWeekEarningsDetailTitle(weekStartYmd: string, weekEndYmd: string): string {
  return `${formatWeekOfMonthChipLabel(weekStartYmd, { includeYear: true })} · ${formatWeekRangeLabel(weekStartYmd, weekEndYmd)}`;
}

/**
 * Picks the Monday-start week to show by default (current week, or range edge if today is outside).
 * `weeksOldestFirst` must be sorted ascending by `week_start`.
 */
export function defaultCarouselWeekStart(weeksOldestFirst: { week_start: string }[]): string {
  if (weeksOldestFirst.length === 0) return "";
  const todayMon = mondayYmdForToday();
  if (todayMon < weeksOldestFirst[0]!.week_start) return weeksOldestFirst[0]!.week_start;
  let best = weeksOldestFirst[0]!.week_start;
  for (const w of weeksOldestFirst) {
    if (w.week_start <= todayMon) best = w.week_start;
  }
  return best;
}

export function mondayYmdForToday(): string {
  return toYmdLocal(getMondayOfDate(new Date()));
}
