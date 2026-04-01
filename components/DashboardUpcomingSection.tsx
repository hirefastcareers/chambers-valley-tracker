"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import StatusIndicator from "@/components/StatusIndicator";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import type { JobStatus } from "@/lib/status";

type UpcomingJobItem = {
  kind: "job";
  id: number;
  customer_id: number;
  customer_name: string;
  job_type: string;
  status: JobStatus;
  quote_amount: string | number | null;
  date: string;
  time_of_day: "am" | "pm" | "all_day" | null;
};

type UpcomingFollowUpItem = {
  kind: "follow_up";
  id: number;
  customer_name: string;
  follow_up_notes: string;
  date: string;
};

export type UpcomingItem = UpcomingJobItem | UpcomingFollowUpItem;

function sortByDateAsc(items: UpcomingItem[]) {
  return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function DashboardUpcomingSection({ initialItems }: { initialItems: UpcomingItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<UpcomingItem[]>(sortByDateAsc(initialItems));

  useEffect(() => {
    setItems(sortByDateAsc(initialItems));
  }, [initialItems]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  function markFollowUpDone(item: UpcomingFollowUpItem) {
    const snapshot = { ...item };
    setItems((prev) => prev.filter((it) => !(it.kind === "follow_up" && it.id === item.id)));

    void (async () => {
      try {
        const res = await fetch(`/api/follow-ups/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!res.ok) {
          setItems((prev) => {
            if (prev.some((it) => it.kind === "follow_up" && it.id === item.id)) return prev;
            return sortByDateAsc([...prev, snapshot]);
          });
          return;
        }
        router.refresh();
      } catch {
        setItems((prev) => {
          if (prev.some((it) => it.kind === "follow_up" && it.id === item.id)) return prev;
          return sortByDateAsc([...prev, snapshot]);
        });
      }
    })();
  }

  if (!hasItems) return null;

  return (
    <Card>
      <div className="px-4 pt-6 pb-4 flex items-center justify-between border-b border-[var(--c-border)]">
        <div>
          <div className="section-label-card !mt-0 !mb-0">UPCOMING JOBS</div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2">
        {items.map((item) => {
          if (item.kind === "job") {
            return (
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
            );
          }

          return (
            <div
              key={`follow-up-${item.id}`}
              className="flex items-start justify-between gap-3 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-5"
            >
              <div className="min-w-0 pr-2">
                <div className="font-semibold text-[15px] text-[var(--c-text)] truncate">{item.customer_name}</div>
                <div className="text-[13px] text-[var(--c-text-muted)] mt-2">{item.follow_up_notes || "Follow-up"}</div>
                <div className="text-[13px] text-[var(--c-text-muted)] mt-2">{formatDateDDMMYYYY(item.date)}</div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                <div className="text-[12px] text-[var(--c-text-subtle)]">Follow-up</div>
                <button
                  type="button"
                  onClick={() => markFollowUpDone(item)}
                  className="rounded-[8px] border border-[var(--c-border-strong)] bg-white px-[14px] py-[5px] text-[13px] text-[var(--c-text)]"
                >
                  Done
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
