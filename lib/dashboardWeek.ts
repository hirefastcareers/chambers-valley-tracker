/** Calendar YMD helpers (date-only, no timezone). */

export function addDaysToYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function dayOfWeekFromYmd(ymd: string): number {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(ymd.trim());
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/**
 * Dashboard upcoming jobs week: Mon–Sun of current week, or next week if today is Sat/Sun.
 */
export function getDashboardWeekBounds(londonTodayYmd: string): { monday: string; sunday: string } {
  let dow = dayOfWeekFromYmd(londonTodayYmd);
  let monday: string;

  if (dow === 0 || dow === 6) {
    const daysUntilMonday = dow === 0 ? 1 : 2;
    monday = addDaysToYmd(londonTodayYmd, daysUntilMonday);
  } else {
    monday = addDaysToYmd(londonTodayYmd, -(dow - 1));
  }

  return { monday, sunday: addDaysToYmd(monday, 6) };
}

export function normalizeCalendarYmd(input: string): string {
  if (!input || typeof input !== "string") return "";
  const part = (input.includes("T") ? input.split("T")[0]! : input.slice(0, 10)).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(part);
  if (!m) return "";
  return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
}
