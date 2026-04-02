import { format } from "date-fns";
import { formatMoneyGBP } from "@/lib/format";

export type WeeklyEarningsInput = {
  weekMondayYmd: string;
  weekFridayYmd: string;
  earnedRaw: string | number | null | undefined;
  potentialRaw: string | number | null | undefined;
  weeklyTargetRaw: string | null | undefined;
};

export type WeeklyEarningsSummary = {
  weekRangeLabel: string;
  showAmountInHeader: boolean;
  headerAmountFormatted?: string;
  earned: number;
  potential: number;
  combinedTotal: number;
  target: number;
  greenWidthPercent: number;
  amberWidthPercent: number;
  displayPercent: number;
  targetMet: boolean;
  /** Right caption when below target: `12% of £350.00 target` */
  percentOfTargetLine: string;
};

function parseYmdLocal(ymd: string): Date {
  const part = ymd.split("T")[0] ?? "";
  const [y, m, d] = part.split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
}

function parseAmount(raw: string | number | null | undefined): number {
  const n = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function weeklyEarningsUnavailableSummary(fallbackTarget = 350): WeeklyEarningsSummary {
  const targetStr = formatMoneyGBP(fallbackTarget);
  return {
    weekRangeLabel: "—",
    showAmountInHeader: false,
    headerAmountFormatted: undefined,
    earned: 0,
    potential: 0,
    combinedTotal: 0,
    target: fallbackTarget,
    greenWidthPercent: 0,
    amberWidthPercent: 0,
    displayPercent: 0,
    targetMet: false,
    percentOfTargetLine: `0% of ${targetStr} target`,
  };
}

export function buildWeeklyEarningsSummary(input: WeeklyEarningsInput): WeeklyEarningsSummary {
  const mon = parseYmdLocal(input.weekMondayYmd);
  const fri = parseYmdLocal(input.weekFridayYmd);
  const weekRangeLabel = `${format(mon, "d MMM")}\u2013${format(fri, "d MMM")}`.toUpperCase();

  const earned = parseAmount(input.earnedRaw);
  const potential = parseAmount(input.potentialRaw);
  const combinedTotal = earned + potential;

  const parsedTarget = Number.parseFloat(String(input.weeklyTargetRaw ?? "").trim());
  const target = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 350;

  const showAmountInHeader = combinedTotal > 0;
  const headerAmountFormatted = showAmountInHeader ? formatMoneyGBP(combinedTotal) : undefined;

  let greenWidthPercent = 0;
  let amberWidthPercent = 0;
  if (target > 0) {
    if (combinedTotal >= target && combinedTotal > 0) {
      greenWidthPercent = (earned / combinedTotal) * 100;
      amberWidthPercent = (potential / combinedTotal) * 100;
    } else {
      greenWidthPercent = Math.min(100, Math.max(0, (earned / target) * 100));
      amberWidthPercent = Math.min(
        (potential / target) * 100,
        Math.max(0, 100 - greenWidthPercent)
      );
    }
  }

  const ratio = target > 0 ? combinedTotal / target : 0;
  const displayPercent = Math.min(100, Math.round(ratio * 100));
  const targetMet = combinedTotal >= target;

  const targetStr = formatMoneyGBP(target);
  const percentOfTargetLine = `${displayPercent}% of ${targetStr} target`;

  return {
    weekRangeLabel,
    showAmountInHeader,
    headerAmountFormatted,
    earned,
    potential,
    combinedTotal,
    target,
    greenWidthPercent,
    amberWidthPercent,
    displayPercent,
    targetMet,
    percentOfTargetLine,
  };
}
