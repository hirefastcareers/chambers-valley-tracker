import { format } from "date-fns";
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

export function getJobQueryDateBounds(): { start: string; end: string } {
  const weeks = enumerateTaxWeeksMonSun();
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (!first || !last) {
    return { start: "1970-01-01", end: "1970-01-01" };
  }
  return { start: first.week_start, end: last.week_end };
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
  return `${format(start, "EEE d MMM", { locale: enGB })} \u2013 ${format(end, "EEE d MMM", { locale: enGB })}`;
}

export function mondayYmdForToday(): string {
  return toYmdLocal(getMondayOfDate(new Date()));
}
