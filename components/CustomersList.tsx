"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY, formatMoneyGBP, toWhatsAppInternational } from "@/lib/format";
import { useOptimisticCustomers } from "@/components/OptimisticCustomersProvider";
import PageHeader from "@/components/PageHeader";
import { ShimmerBlock } from "@/components/skeletons";

type CustomerRow = {
  id: number | string;
  name: string;
  phone: string | null;
  next_follow_up_date: string | null;
  tags?: string[] | null;
};

export default function CustomersList() {
  const router = useRouter();
  const optimistic = useOptimisticCustomers();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedJobStatus, setSelectedJobStatus] = useState<"all" | "quoted" | "booked" | "completed" | "needs_follow_up">("all");
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const TAG_OPTIONS = ["Regular", "One-off", "Needs chasing", "VIP", "Seasonal"] as const;

  type JobFilterRow = {
    job_id: number | string;
    customer_name: string;
    job_type: string;
    date_done: string | null;
    quote_amount: string | number | null;
    status: "quoted" | "booked" | "completed" | "needs_follow_up";
    paid?: boolean;
  };

  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsRows, setJobsRows] = useState<JobFilterRow[]>([]);

  const canSearch = useMemo(() => search.trim().length >= 0, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers(currentSearch: string) {
      setLoading(true);
      setDeleteError(null);
      try {
        const params = new URLSearchParams();
        params.set("search", currentSearch);
        if (selectedTag) params.set("tag", selectedTag);
        const res = await fetch(`/api/customers?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function load() {
      if (selectedJobStatus !== "all") return;
      await loadCustomers(search.trim());
    }

    if (!canSearch) return;
    const t = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, canSearch, selectedTag, selectedJobStatus]);

  useEffect(() => {
    if (selectedJobStatus === "all") return;
    let cancelled = false;

    async function loadJobs() {
      setJobsLoading(true);
      try {
        const res = await fetch(`/api/jobs?status=${selectedJobStatus}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setJobsRows(Array.isArray(data?.jobs) ? data.jobs : []);
      } finally {
        if (!cancelled) setJobsLoading(false);
      }
    }

    loadJobs();
    return () => {
      cancelled = true;
    };
  }, [selectedJobStatus]);

  const mergedCustomers = useMemo(() => {
    const prepends = optimistic?.optimisticPrepends ?? [];
    const hidden = optimistic?.hiddenCustomerIds ?? new Set<number>();
    const prependedRows: CustomerRow[] = prepends.map((p) => ({
      id: p.tempId,
      name: p.name,
      phone: p.phone,
      next_follow_up_date: null,
      tags: [],
    }));
    const filtered = customers.filter((c) => {
      const n = typeof c.id === "string" ? Number(c.id) : Number(c.id);
      if (!Number.isFinite(n)) return true;
      return !hidden.has(n);
    });
    return [...prependedRows, ...filtered];
  }, [customers, optimistic?.optimisticPrepends, optimistic?.hiddenCustomerIds]);

  async function deleteCustomer(customerId: string, customerName: string) {
    if (deletingId) return;
    const ok = window.confirm(
      `Delete ${customerName}? This will also delete their jobs, photos, and follow-ups.`
    );
    if (!ok) return;

    const idNum = Number(customerId);
    if (Number.isFinite(idNum)) optimistic?.hideCustomerOptimistic(idNum);

    setDeletingId(customerId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        return;
      }

      if (Number.isFinite(idNum)) optimistic?.unhideCustomer(idNum);
      const data = await res.json().catch(() => null);
      const msg = typeof data?.error === "string" ? data.error : "Could not delete customer";
      setDeleteError(msg);
    } catch {
      if (Number.isFinite(idNum)) optimistic?.unhideCustomer(idNum);
      setDeleteError("Could not delete customer");
    } finally {
      setDeletingId(null);
    }
  }

  const sectionLabel = "section-label-card pt-5 pb-2.5";
  const filterCard =
    "rounded-2xl bg-[var(--color-white)] shadow-[var(--shadow-card)] border border-[rgba(26,71,49,0.08)] p-[18px]";
  const inputClass =
    "mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none bg-[var(--color-white)] text-[var(--color-text)] input-premium";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader className="!mb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] text-white leading-tight font-normal">Customers</h1>
            <p className="text-[12px] text-[#52b788] mt-1.5">
              {mergedCustomers.length} {mergedCustomers.length === 1 ? "customer" : "customers"}
            </p>
          </div>
          <Link
            href="/customers/new"
            className="shrink-0 rounded-full bg-white text-[#1a4731] px-4 py-2.5 text-sm font-semibold shadow-sm btn-primary-interactive"
          >
            Add Customer
          </Link>
        </div>
      </PageHeader>

      <div className="-mt-7 relative z-10 mb-2">
        <div className={filterCard}>
          <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-[var(--color-text-muted)] pb-2.5">
            Search
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email..."
            className={inputClass.replace("mt-2 ", "")}
          />
        </div>
      </div>

      <div className={filterCard}>
        <div className={sectionLabel}>Filter by tags</div>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => {
            const active = selectedTag === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTag((prev) => (prev === t ? null : t))}
                className={[
                  "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors duration-150",
                  active
                    ? "bg-[var(--color-primary)] text-[var(--color-white)] border-[var(--color-primary)]"
                    : "bg-[var(--color-white)] text-[var(--color-text)] border-[var(--color-border)]",
                  "active:scale-[0.98]",
                ].join(" ")}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className={filterCard}>
        <div className={sectionLabel}>Filter jobs by status</div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "all", label: "All" },
              { value: "quoted", label: "Quoted" },
              { value: "booked", label: "Booked" },
              { value: "completed", label: "Completed" },
              { value: "needs_follow_up", label: "Needs follow-up" },
            ] as const
          ).map((b) => {
            const active = selectedJobStatus === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setSelectedJobStatus(b.value)}
                className={[
                  "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors duration-150",
                  active
                    ? "bg-[var(--color-primary)] text-[var(--color-white)] border-[var(--color-primary)]"
                    : "bg-[var(--color-white)] text-[var(--color-text)] border-[var(--color-border)]",
                  "active:scale-[0.98]",
                ].join(" ")}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-y-auto pb-4">
        {selectedJobStatus !== "all" ? (
          jobsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <ShimmerBlock key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : jobsRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[#f6faf6]/80 px-[18px] py-12 text-center">
              <div className="text-5xl mb-4" aria-hidden>
                🌿
              </div>
              <p className="font-display text-[18px] text-[#1a4731]">No matching jobs</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">Try another status filter.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobsRows.map((r) => (
                <div
                  key={String(r.job_id)}
                  className="rounded-2xl bg-[var(--color-white)] shadow-[var(--shadow-card)] border border-[var(--color-border)] p-[18px] clickable-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display text-[15px] font-semibold text-[var(--color-text)] truncate">{r.customer_name}</div>
                      <div className="text-[13px] text-[var(--color-text)] mt-1">{r.job_type}</div>
                      <div className="text-[13px] text-[var(--color-text-muted)] mt-1">
                        {r.date_done ? formatDateDDMMYYYY(r.date_done) : "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-[17px] text-[#2d6a4f]">{formatMoneyGBP(r.quote_amount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-[var(--color-white)] shadow-[var(--shadow-card)] border border-[var(--color-border)] p-[18px] flex justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <ShimmerBlock className="h-5 w-48 max-w-[80%]" />
                  <ShimmerBlock className="h-4 w-36" />
                  <ShimmerBlock className="h-3 w-44" />
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <ShimmerBlock className="h-9 w-16 rounded-xl" />
                  <ShimmerBlock className="h-9 w-16 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : mergedCustomers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[#f6faf6]/80 px-[18px] py-14 text-center">
            <div className="text-5xl mb-4" aria-hidden>
              📋
            </div>
            <p className="font-display text-[18px] text-[#1a4731]">No customers yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">Tap Add Customer to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mergedCustomers.map((c) => {
              const idStr = typeof c.id === "string" ? c.id : String(c.id);
              const editHrefId = idStr && Number.isFinite(Number(idStr)) ? idStr : "";
              const idNum = Number(editHrefId);
              const isOptimisticRow = Number.isFinite(idNum) && idNum < 0;
              const whatsapp = c.phone ? toWhatsAppInternational(c.phone) : "";
              const href = editHrefId && !isOptimisticRow ? `/customers/${editHrefId}` : null;
              const canNavigate = Boolean(href);
              const onCardNavigate = () => {
                if (!canNavigate || !href || isOptimisticRow) return;
                router.push(href);
              };
              return (
                <div
                  key={editHrefId || idStr}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open customer ${c.name}`}
                  onClick={onCardNavigate}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && canNavigate) {
                      e.preventDefault();
                      onCardNavigate();
                    }
                  }}
                  className={[
                    "rounded-2xl bg-[var(--color-white)] shadow-[var(--shadow-card)] border border-[rgba(26,71,49,0.08)] p-[18px]",
                    canNavigate ? "cursor-pointer clickable-card" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-[var(--color-text)] truncate text-[15px] flex items-center gap-2">
                        {c.name}
                        {isOptimisticRow ? (
                          <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-pale)] text-[var(--color-primary)]">
                            Adding…
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-[var(--color-text)] mt-2">
                        {c.phone ? (
                          <a
                            href={`https://wa.me/${whatsapp}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--color-primary)] font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">No phone</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-2">
                        Next follow-up:{" "}
                        {c.next_follow_up_date ? formatDateDDMMYYYY(c.next_follow_up_date) : "—"}
                      </div>
                      {Array.isArray(c.tags) && c.tags.length ? (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {c.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border border-[var(--color-border)] bg-[var(--color-primary-surface)] text-[var(--color-text)]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {editHrefId ? (
                        <Link
                          href={`/customers/${editHrefId}`}
                          className="px-3 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-primary)] bg-[var(--color-white)] btn-primary-interactive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Edit
                        </Link>
                      ) : (
                        <div className="px-3 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-muted)] bg-[var(--color-white)]">
                          Edit
                        </div>
                      )}

                      {editHrefId && Number(editHrefId) > 0 ? (
                        <button
                          type="button"
                          onClick={() => deleteCustomer(editHrefId, c.name)}
                          disabled={deletingId === editHrefId}
                          className="px-3 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-red)] bg-[var(--color-red-bg)] btn-destructive-press disabled:opacity-60"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {deletingId === editHrefId ? "Deleting..." : "Delete"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteError ? (
        <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border)] rounded-2xl px-4 py-3">
          {deleteError}
        </div>
      ) : null}
    </div>
  );
}
