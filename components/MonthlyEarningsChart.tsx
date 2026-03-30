"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function MonthlyEarningsChart({
  data,
}: {
  data: { monthLabel: string; value: number }[];
}) {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: "var(--c-text-muted)" }} />
          <YAxis tick={{ fontSize: 12, fill: "var(--c-text-muted)" }} />
          <Tooltip
            formatter={(v: unknown) => {
              const num = typeof v === "number" ? v : Number(v);
              return [`£${Number.isFinite(num) ? num.toFixed(2) : "0.00"}`, "Earnings"];
            }}
            contentStyle={{
              borderRadius: 12,
              borderColor: "var(--c-border)",
              background: "var(--c-surface)",
            }}
          />
          <Bar dataKey="value" fill="var(--c-info)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
