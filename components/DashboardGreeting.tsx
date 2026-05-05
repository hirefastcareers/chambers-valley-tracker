"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseDateStartOfDayLocal, startOfTodayLocal } from "@/lib/format";
import type { FollowUpDueRow } from "@/components/DashboardFollowUpsSection";

export default function DashboardGreeting({
  greeting,
  initialFollowUpsDue,
}: {
  greeting: string;
  initialFollowUpsDue: FollowUpDueRow[];
}) {
  const router = useRouter();
  const today = startOfTodayLocal();

  const overdueRows = useMemo(
    () =>
      initialFollowUpsDue.filter((f) => {
        const due = parseDateStartOfDayLocal(f.follow_up_date);
        return Boolean(due && due < today);
      }),
    [initialFollowUpsDue, today]
  );

  const [optimisticOverdueCount, setOptimisticOverdueCount] = useState(overdueRows.length);

  useEffect(() => {
    function onOverdueCount(event: Event) {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setOptimisticOverdueCount(detail.count);
      }
    }
    window.addEventListener("patch:overdue-followups-count", onOverdueCount as EventListener);
    return () => window.removeEventListener("patch:overdue-followups-count", onOverdueCount as EventListener);
  }, []);

  function onBadgeClick() {
    const section = document.getElementById("follow-ups-due-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const firstOverdueCustomerId = Number(overdueRows[0]?.customer_id ?? NaN);
    if (Number.isFinite(firstOverdueCustomerId)) {
      router.push(`/customers/${firstOverdueCustomerId}`);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-[22px] font-semibold text-[var(--c-text)] leading-tight">{greeting}</h1>
      {optimisticOverdueCount > 0 ? (
        <button
          type="button"
          onClick={onBadgeClick}
          className="inline-flex items-center justify-center rounded-full bg-[#dc2626] text-white text-[11px] font-semibold min-w-[20px] h-[20px] px-[6px]"
          aria-label={`${optimisticOverdueCount} overdue follow-ups`}
          title="Go to overdue follow-ups"
        >
          {optimisticOverdueCount}
        </button>
      ) : null}
    </div>
  );
}
