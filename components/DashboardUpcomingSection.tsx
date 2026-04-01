"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import StatusIndicator from "@/components/StatusIndicator";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import type { JobStatus } from "@/lib/status";

export type UpcomingJobItem = {
  id: number;
  customer_id: number;
  customer_name: string;
  job_type: string;
  status: JobStatus;
  quote_amount: string | number | null;
  date: string;
  time_of_day: "am" | "pm" | "all_day" | null;
};

function sortByDateAsc(items: UpcomingJobItem[]) {
  return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function DashboardUpcomingSection({ initialItems }: { initialItems: UpcomingJobItem[] }) {
  const [items, setItems] = useState<UpcomingJobItem[]>(sortByDateAsc(initialItems));

  useEffect(() => {
    setItems(sortByDateAsc(initialItems));
  }, [initialItems]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  if (!hasItems) return null;

  return (
    <Card>
      <div className="px-4 pt-6 pb-4 flex items-center justify-between border-b border-[var(--c-border)]">
        <div>
          <div className="section-label-card !mt-0 !mb-0">UPCOMING JOBS</div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={`job-${item.id}`}
            href={`/customers/${item.customer_id}?job_id=${item.id}`}
            className="relative flex items-start justify-between gap-3 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-5 cursor-pointer clickable-card"
            aria-label={`Open customer ${item.customer_name} for job ${item.job_type}`}
          >
            <div className="min-w-0 pr-2">
              <div className="font-semibold text-[15px] text-[var(--c-text)] truncate">{item.customer_name}</div>
              <div className="text-[13px] text-[var(--c-text-muted)] mt-2">{item.job_type}</div>
              <div className="text-[13px] text-[var(--c-text-muted)] mt-2">
                {formatDateDDMMYYYY(item.date)}
                {item.time_of_day === "am" ? " · AM" : item.time_of_day === "pm" ? " · PM" : ""}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2 text-right">
              <StatusIndicator status={item.status} />
              <div className="font-currency text-[17px] text-[var(--c-text)]">{formatMoneyGBP(item.quote_amount)}</div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
