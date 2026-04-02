import { format } from "date-fns";
import { formatMoneyGBP } from "@/lib/format";

export type WeeklyEarningsInput = {
  weekMondayYmd: string;
  weekFridayYmd: string;
  weeklyTotalRaw: string | number | null | undefined;
  weeklyTargetRaw: string | null | undefined;
};

export type WeeklyEarningsSummary = {
  weekRangeLabel: string;
  showAmountInHeader: boolean;
  headerAmountFormatted?: string;
  weeklyTotal: number;
  target: number;
  barWidthPercent: number;
  displayPercent: number;
  targetMet: boolean;
  ofTargetLeftText: string;
  percentRightText: string;
};

function parseYmdLocal(ymd: string): Date {
  const part = ymd.split("T")[0] ?? "";
  const [y, m, d] = part.split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
}

export function weeklyEarningsUnavailableSummary(fallbackTarget = 350): WeeklyEarningsSummary {
  const targetStr = formatMoneyGBP(fallbackTarget);
  const zeroStr = formatMoneyGBP(0);
  return {
    weekRangeLabel: "—",
    showAmountInHeader: false,
    headerAmountFormatted: undefined,
    weeklyTotal: 0,
    target: fallbackTarget,
    barWidthPercent: 0,
    displayPercent: 0,
    targetMet: false,
    ofTargetLeftText: `${zeroStr} of ${targetStr} target`,
    percentRightText: "0%",
  };
}

export function buildWeeklyEarningsSummary(input: WeeklyEarningsInput): WeeklyEarningsSummary {
  const mon = parseYmdLocal(input.weekMondayYmd);
  const fri = parseYmdLocal(input.weekFridayYmd);
  const weekRangeLabel = `${format(mon, "d MMM")}\u2013${format(fri, "d MMM")}`.toUpperCase();

  const weeklyTotal =
    typeof input.weeklyTotalRaw === "string"
      ? Number.parseFloat(input.weeklyTotalRaw)
      : Number(input.weeklyTotalRaw ?? 0);
  const safeTotal = Number.isFinite(weeklyTotal) ? weeklyTotal : 0;

  const parsedTarget = Number.parseFloat(String(input.weeklyTargetRaw ?? "").trim());
  const target = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 350;

  const showAmountInHeader = safeTotal > 0;
  const headerAmountFormatted = showAmountInHeader ? formatMoneyGBP(safeTotal) : undefined;

  const ratio = target > 0 ? safeTotal / target : 0;
  const barWidthPercent = Math.min(100, Math.max(0, ratio * 100));
  const displayPercent = Math.min(100, Math.round(ratio * 100));
  const targetMet = safeTotal >= target;

  const totalStr = formatMoneyGBP(safeTotal);
  const targetStr = formatMoneyGBP(target);

  const ofTargetLeftText = targetMet
    ? `${totalStr} of ${targetStr} target · Target met 🎯`
    : `${totalStr} of ${targetStr} target`;

  const percentRightText = `${displayPercent}%`;

  return {
    weekRangeLabel,
    showAmountInHeader,
    headerAmountFormatted,
    weeklyTotal: safeTotal,
    target,
    barWidthPercent,
    displayPercent,
    targetMet,
    ofTargetLeftText,
    percentRightText,
  };
}
