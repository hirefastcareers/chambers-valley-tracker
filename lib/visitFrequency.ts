/**
 * Formats average gap between consecutive completed visits (days).
 * Returns null when there is nothing to show (< 2 completed jobs with dates).
 */
export function formatVisitFrequencyLabel(avgGapDays: number | string | null | undefined): string | null {
  if (avgGapDays === null || avgGapDays === undefined) return null;
  const avg = typeof avgGapDays === "string" ? Number(avgGapDays) : avgGapDays;
  if (!Number.isFinite(avg) || avg <= 0) return null;

  if (avg <= 7) {
    const days = Math.max(1, Math.round(avg));
    return days === 1 ? "Visits every 1 day" : `Visits every ${days} days`;
  }

  // Roughly between one and two weeks: round to nearest day (e.g. 10-day average → "every 10 days").
  // From ~two weeks onward, round to the nearest whole week (e.g. 25d → 4wk, 35d → 5wk).
  if (avg < 14) {
    const days = Math.max(1, Math.round(avg));
    return days === 1 ? "Visits every 1 day" : `Visits every ${days} days`;
  }

  const weeks = Math.max(2, Math.round(avg / 7));
  return `Visits every ${weeks} weeks`;
}
