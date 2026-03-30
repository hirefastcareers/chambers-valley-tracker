"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { formatDateDDMMYYYY, formatMoneyGBP } from "@/lib/format";
import type { JobStatus } from "@/lib/status";

type StatusFilter = "all" | JobStatus;
type TimeFilter = "all" | "am" | "pm" | "all_day";
type SortOrder = "asc" | "desc";

type JobRow = {
  job_id: number | string;
  customer_id: number | string;
  customer_name: string;
  job_type: string;
  description: string | null;
  status: JobStatus;
  date_done: string | null;
  time_of_day: "am" | "pm" | "all_day" | null;
  quote_amount: string | number | null;
  paid: boolean;
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: "am", label: "AM" },
  { value: "pm", label: "PM" },
  { value: "all_day", label: "All day" },
];

function defaultOrderForStatus(status: StatusFilter): SortOrder {
  return status === "quoted" || status === "booked" ? "asc" : "desc";
}

function timeLabel(value: JobRow["time_of_day"]) {
  if (value === "am") return "AM";
  if (value === "pm") return "PM";
  return "All day";
}

/** Second line: description only when present and not redundant with job type (case-insensitive). */
function extraDescription(jobType: string, description: string | null): string | null {
  const d = description?.trim() ?? "";
  if (!d) return null;
  const t = jobType.trim();
  if (d.localeCompare(t, undefined, { sensitivity: "accent" }) === 0) return null;
  return d;
}

export default function JobsList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [order, setOrder] = useState<SortOrder>(() => defaultOrderForStatus("all"));
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const limit = 20;
  const chips = useMemo(
    () => [{ value: "all" as const, label: "All" }, ...STATUS_FILTERS.slice(1), ...TIME_FILTERS],
    []
  );

  useEffect(() => {
    setOrder(defaultOrderForStatus(statusFilter));
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    async function loadFirstPage() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", "0");
        params.set("sort", "date_done");
        params.set("order", order);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (timeFilter !== "all") params.set("time_of_day", timeFilter);
        const res = await fetch(`/api/jobs?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const rows = Array.isArray(data?.jobs) ? (data.jobs as JobRow[]) : [];
        setJobs(rows);
        setTotal(Number(data?.total ?? rows.length));
        setHasMore(Boolean(data?.hasMore));
        setOffset(rows.length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, timeFilter, order]);

  async function loadMore() {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("sort", "date_done");
    params.set("order", order);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (timeFilter !== "all") params.set("time_of_day", timeFilter);

    const res = await fetch(`/api/jobs?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    const rows = Array.isArray(data?.jobs) ? (data.jobs as JobRow[]) : [];
    setJobs((prev) => [...prev, ...rows]);
    setTotal(Number(data?.total ?? total));
    setHasMore(Boolean(data?.hasMore));
    setOffset((prev) => prev + rows.length);
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader className="!mb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--color-text)] leading-tight">Jobs</h1>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-1">
              {total} {total === 1 ? "job" : "jobs"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            className="shrink-0 btn-header-outline btn-primary-interactive"
          >
            {order === "desc" ? "Newest" : "Oldest"}
          </button>
        </div>
        <div className="mt-4 -mx-4 px-4 overflow-x-auto scrollbar-none">
          <div className="inline-flex items-center gap-2 min-w-max">
            {chips.map((chip) => {
              const isStatus = STATUS_FILTERS.some((s) => s.value === chip.value);
              const isTime = TIME_FILTERS.some((t) => t.value === chip.value);
              const active =
                chip.value === "all"
                  ? statusFilter === "all" && timeFilter === "all"
                  : isStatus
                    ? statusFilter === chip.value
                    : isTime
                      ? timeFilter === chip.value
                      : false;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => {
                    if (chip.value === "all") {
                      setStatusFilter("all");
                      setTimeFilter("all");
                      return;
                    }
                    if (isStatus) {
                      setStatusFilter(chip.value as StatusFilter);
                      return;
                    }
                    if (isTime) {
                      setTimeFilter((chip.value as TimeFilter) === timeFilter ? "all" : (chip.value as TimeFilter));
                    }
                  }}
                  className={[
                    "px-3 py-2 rounded-full text-xs font-semibold border transition-colors duration-150 whitespace-nowrap",
                    active
                      ? "bg-[#1e293b] text-white border-[#1e293b]"
                      : "bg-white text-[var(--color-text)] border-[var(--color-border)]",
                  ].join(" ")}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-[18px] py-12 text-center text-[var(--color-text-muted)]">
          Loading jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-[18px] py-12 text-center">
          <div className="flex justify-center mb-4 text-[var(--color-text-muted)]" aria-hidden>
            <ClipboardList className="w-12 h-12 stroke-[1.5]" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--color-text)]">No jobs found</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Try a different filter</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => {
            const descExtra = extraDescription(job.job_type, job.description);
            return (
            <div
              key={String(job.job_id)}
              className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/customers/${job.customer_id}?job_id=${job.job_id}`}
                    className="inline-block text-[15px] font-semibold text-[var(--color-text)] truncate hover:underline"
                  >
                    {job.customer_name}
                  </Link>
                  <div className="mt-1 text-[15px] font-semibold text-[var(--color-text)]">{job.job_type}</div>
                  {descExtra ? (
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                      {descExtra}
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                    <span>{formatDateDDMMYYYY(job.date_done)}</span>
                    <span>·</span>
                    <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-primary-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                      {timeLabel(job.time_of_day)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                  <StatusBadge status={job.status} />
                  <div className="font-currency text-[17px] text-[var(--color-text)]">
                    {formatMoneyGBP(job.quote_amount)}
                  </div>
                  {job.paid ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-[var(--color-primary-pale)] text-[var(--color-primary)] border border-[var(--color-border)] text-xs font-semibold">
                      Paid ✓
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            );
          })}
          {hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              className="rounded-[12px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)] btn-primary-interactive"
            >
              Load more
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

