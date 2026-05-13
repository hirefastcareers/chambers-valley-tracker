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
  return `${format(start, "EEE d MMM", { locale: enGB })} \u2013 ${format(end, "EEE d MMM", { locale: enGB })}`;
}

/** Short chip label e.g. 31 Mar – 6 Apr (day + month, no weekday). */
export function formatWeekChipShortRange(weekStartYmd: string, weekEndYmd: string): string {
  const start = parseYmdLocal(weekStartYmd);
  const end = parseYmdLocal(weekEndYmd);
  if (!isValid(start) || !isValid(end)) return "—";
  return `${format(start, "d MMM", { locale: enGB })} \u2013 ${format(end, "d MMM", { locale: enGB })}`;
}

/** Dashboard header: same calendar month → "4–10 May"; across months → "28 Apr–4 May". */
export function formatWeekDashboardHeaderRange(weekStartYmd: string, weekEndYmd: string): string {
  const start = parseYmdLocal(weekStartYmd);
  const end = parseYmdLocal(weekEndYmd);
  if (!isValid(start) || !isValid(end)) return "—";
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${format(start, "d", { locale: enGB })}\u2013${format(end, "d MMM", { locale: enGB })}`;
  }
  return `${format(start, "d MMM", { locale: enGB })}\u2013${format(end, "d MMM", { locale: enGB })}`;
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
 * Week-of-month chip, e.g. W1 May.
 * Label month = calendar month with the most Mon–Sun days in that week (tie → later month).
 * Week number = 1 + whole weeks from the Monday of the week that contains the 1st of that month
 * to this week’s Monday (W1 is the week containing the 1st, including partial weeks).
 */
export function formatWeekOfMonthChipLabel(weekStartYmd: string): string {
  const chipMonday = parseYmdLocal(weekStartYmd);
  const { y, m } = majorityCalendarMonthForWeek(weekStartYmd);
  const firstOfMonth = new Date(y, m, 1);
  const anchorMonday = getMondayOfDate(firstOfMonth);
  const diffDays = differenceLocalCalendarDays(anchorMonday, chipMonday);
  const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
  const monthAbbr = format(new Date(y, m, 1), "MMM", { locale: enGB });
  return `W${weekNum} ${monthAbbr}`;
}

/** Full title line: chip + weekday range (e.g. W1 May · Mon 28 Apr – Sun 4 May). */
export function formatWeekEarningsDetailTitle(weekStartYmd: string, weekEndYmd: string): string {
  return `${formatWeekOfMonthChipLabel(weekStartYmd)} · ${formatWeekRangeLabel(weekStartYmd, weekEndYmd)}`;
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
