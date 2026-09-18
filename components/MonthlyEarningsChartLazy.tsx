"use client";

import dynamic from "next/dynamic";
import { ShimmerBlock } from "@/components/skeletons";

const MonthlyEarningsChart = dynamic(() => import("@/components/MonthlyEarningsChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center">
      <ShimmerBlock className="h-56 w-full" />
    </div>
  ),
});

export default function MonthlyEarningsChartLazy({
  data,
}: {
  data: { monthLabel: string; value: number }[];
}) {
  return <MonthlyEarningsChart data={data} />;
}
