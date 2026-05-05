/** UK tax year label for a calendar date (April 6 – April 5), e.g. "2025/26". */
export function ukTaxYearLabelFromISODate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const part = String(isoDate).split("T")[0] ?? "";
  const [y, m, d] = part.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";

  let startYear = y;
  if (m < 4 || (m === 4 && d < 6)) {
    startYear = y - 1;
  }
  const endShort = (startYear + 1) % 100;
  return `${startYear}/${String(endShort).padStart(2, "0")}`;
}
