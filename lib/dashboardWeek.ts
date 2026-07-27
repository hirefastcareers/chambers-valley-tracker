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

/** Mon–Sun of the calendar week containing `londonTodayYmd`. */
export function getCurrentWeekBounds(londonTodayYmd: string): { monday: string; sunday: string } {
  const dow = dayOfWeekFromYmd(londonTodayYmd);
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = addDaysToYmd(londonTodayYmd, -daysFromMonday);
  return { monday, sunday: addDaysToYmd(monday, 6) };
}

/** Mon–Sun of the week immediately after the current calendar week. */
export function getNextWeekBounds(londonTodayYmd: string): { monday: string; sunday: string } {
  const monday = addDaysToYmd(getCurrentWeekBounds(londonTodayYmd).monday, 7);
  return { monday, sunday: addDaysToYmd(monday, 6) };
}

/** Dashboard label suffix, e.g. "W/C 28 Jul". */
export function formatWeekCommencingLabel(mondayYmd: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(mondayYmd.trim());
  if (!m) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = Number(m[3]);
  const month = months[Number(m[2]) - 1] ?? ""];
  return month ? `W/C ${day} ${month}` : "";
}

export function normalizeCalendarYmd(input: string): string {
  if (!input || typeof input !== "string") return "";
  const part = (input.includes("T") ? input.split("T")[0]! : input.slice(0, 10)).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(part);
  if (!m) return "";
  return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
}
