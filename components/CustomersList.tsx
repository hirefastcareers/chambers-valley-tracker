"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, MessageCircle, Pencil, Phone, Trash2, UserRound } from "lucide-react";
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
  last_job_type?: string | null;
  last_job_date?: string | null;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);

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

  useEffect(() => {
    function detectMobile() {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const mobileByUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      setIsMobileViewport(window.innerWidth < 768 || mobileByUa);
    }
    detectMobile();
    window.addEventListener("resize", detectMobile);
    return () => window.removeEventListener("resize", detectMobile);
  }, []);

  const SWIPE_WIDTH = 92;
  const touchState = useMemo(
    () => ({ id: null as string | null, startX: 0, baseX: 0, moved: false }),
    []
  );

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
    const merged = [...prependedRows, ...filtered];
    merged.sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" })
    );
    return merged;
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

  const filtersActive = selectedTag !== null || selectedJobStatus !== "all";

  const sectionLabel = "section-label-card pt-5 pb-2.5";
  const filterCard =
    "rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-4";
  const inputClass =
    "mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none bg-[var(--color-white)] text-[var(--color-text)] input-premium";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader className="!mb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--color-text)] leading-tight">Customers</h1>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-1">
              {mergedCustomers.length} {mergedCustomers.length === 1 ? "customer" : "customers"}
            </p>
          </div>
          <Link href="/customers/new" className="shrink-0 btn-header-outline btn-primary-interactive">
            Add Customer
          </Link>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="inline-flex items-center gap-2 btn-header-outline btn-primary-interactive"
            aria-expanded={filtersOpen}
            aria-label={filtersActive ? "Filter (filters active)" : "Filter"}
          >
            <span>
              Filter {filtersOpen ? "▴" : "▾"}
            </span>
            {filtersActive ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-bg)]" aria-hidden />
            ) : null}
          </button>
        </div>
      </PageHeader>

      <div className="relative z-10 mb-2">
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

      {filtersOpen ? (
        <>
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
        </>
      ) : null}

      <div className="overflow-y-auto pb-4">
        {selectedJobStatus !== "all" ? (
          jobsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <ShimmerBlock key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : jobsRows.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-[18px] py-12 text-center">
              <div className="flex justify-center mb-4 text-[var(--color-text-muted)]" aria-hidden>
                <ClipboardList className="w-12 h-12 stroke-[1.5]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--color-text)]">No matching jobs</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">Try another status filter.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobsRows.map((r) => (
                <div
                  key={String(r.job_id)}
                  className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-4 clickable-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-[var(--color-text)] truncate">{r.customer_name}</div>
                      <div className="text-[13px] text-[var(--color-text)] mt-1">{r.job_type}</div>
                      <div className="text-[13px] text-[var(--color-text-muted)] mt-1">
                        {r.date_done ? formatDateDDMMYYYY(r.date_done) : "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-currency text-[17px] text-[var(--color-text)]">{formatMoneyGBP(r.quote_amount)}</div>
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
                className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-4 flex justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <ShimmerBlock className="h-5 w-48 max-w-[80%]" />
                  <ShimmerBlock className="h-4 w-36" />
                  <ShimmerBlock className="h-3 w-44" />
                </div>
                <div className="flex flex-row gap-1.5 shrink-0">
                  <ShimmerBlock className="h-7 w-20 rounded-full" />
                  <ShimmerBlock className="h-7 w-12 rounded-full" />
                  <ShimmerBlock className="h-7 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : mergedCustomers.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-[18px] py-14 text-center">
            <div className="flex justify-center mb-4 text-[var(--color-text-muted)]" aria-hidden>
              <UserRound className="w-12 h-12 stroke-[1.5]" />
            </div>
            <p className="text-[15px] font-semibold text-[var(--color-text)]">No customers yet</p>
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
              const translateX =
                draggingId === idStr ? dragX : openSwipeId === idStr ? -SWIPE_WIDTH : 0;

              return (
                <div key={editHrefId || idStr} className="relative overflow-hidden rounded-[14px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomer(editHrefId, c.name);
                    }}
                    className="absolute right-0 top-0 bottom-0 w-[92px] bg-[#ef4444] text-white text-[13px] font-semibold"
                    style={{ borderRadius: "0 14px 14px 0" }}
                    aria-label={`Delete ${c.name}`}
                  >
                    Delete
                  </button>

                  <div
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
                    onTouchStart={(e) => {
                      if (!isMobileViewport) return;
                      touchState.id = idStr;
                      touchState.startX = e.touches[0].clientX;
                      touchState.baseX = openSwipeId === idStr ? -SWIPE_WIDTH : 0;
                      touchState.moved = false;
                      if (openSwipeId && openSwipeId !== idStr) setOpenSwipeId(null);
                      setDraggingId(idStr);
                    }}
                    onTouchMove={(e) => {
                      if (!isMobileViewport || touchState.id !== idStr) return;
                      const dx = e.touches[0].clientX - touchState.startX;
                      const nextX = Math.min(0, Math.max(-SWIPE_WIDTH, touchState.baseX + dx));
                      if (Math.abs(dx) > 8) touchState.moved = true;
                      setDragX(nextX);
                    }}
                    onTouchEnd={(e) => {
                      if (!isMobileViewport || touchState.id !== idStr) return;
                      if (touchState.moved) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                      const shouldOpen = dragX <= -SWIPE_WIDTH / 2;
                      setOpenSwipeId(shouldOpen ? idStr : null);
                      setDraggingId(null);
                      setDragX(0);
                      touchState.id = null;
                    }}
                    className={[
                      "rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-3.5 relative",
                      canNavigate ? "cursor-pointer clickable-card" : "",
                    ].join(" ")}
                    style={{
                      transform: `translateX(${translateX}px)`,
                      transition: draggingId === idStr ? "none" : "transform 180ms ease",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] text-[var(--color-text)] flex items-center gap-2 leading-tight break-words">
                        {c.name}
                        {isOptimisticRow ? (
                          <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-pale)] text-[var(--color-primary)]">
                            Adding…
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[13px] font-normal text-[var(--color-text-muted)]">
                        {c.phone ? (
                          <span>{c.phone}</span>
                        ) : (
                          <span className="text-[var(--color-text-subtle)] italic">No phone</span>
                        )}
                      </div>
                      {c.next_follow_up_date ? (
                        <div className="mt-1 text-[12px] font-normal text-[var(--color-text-subtle)]">
                          Next follow-up: {formatDateDDMMYYYY(c.next_follow_up_date)}
                        </div>
                      ) : null}
                      {c.last_job_type && c.last_job_date ? (
                        <div className="mt-1 text-[12px] font-normal text-[var(--color-text-subtle)]">
                          Last job: {c.last_job_type} · {formatDateDDMMYYYY(c.last_job_date)}
                        </div>
                      ) : null}
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

                    <div className="shrink-0">
                      {c.phone && whatsapp ? (
                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={`https://wa.me/${whatsapp}`}
                            target="_blank"
                            rel="noreferrer"
                            className="h-9 w-9 rounded-full bg-[#25D366] text-white inline-flex items-center justify-center btn-primary-interactive"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`WhatsApp ${c.name}`}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                          <a
                            href={`tel:${c.phone.replace(/\s+/g, "")}`}
                            className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-white)] text-[var(--color-text)] inline-flex items-center justify-center btn-primary-interactive"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Call ${c.name}`}
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          {editHrefId ? (
                            <Link
                              href={`/customers/${editHrefId}`}
                              className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-white)] text-[var(--color-text)] inline-flex items-center justify-center btn-primary-interactive"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Edit ${c.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          ) : (
                            <span className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-white)] text-[var(--color-text-subtle)] inline-flex items-center justify-center">
                              <Pencil className="h-4 w-4" />
                            </span>
                          )}
                          {editHrefId && Number(editHrefId) > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomer(editHrefId, c.name);
                              }}
                              disabled={deletingId === editHrefId}
                              className="h-9 w-9 rounded-full border border-[#fca5a5] bg-[var(--color-white)] text-[var(--color-danger-text)] inline-flex items-center justify-center btn-destructive-press disabled:opacity-60"
                              onMouseDown={(e) => e.stopPropagation()}
                              aria-label={`Delete ${c.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {!c.phone ? (
                        <div className="flex flex-col gap-2">
                          {editHrefId ? (
                            <Link
                              href={`/customers/${editHrefId}`}
                              className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-white)] text-[var(--color-text)] inline-flex items-center justify-center btn-primary-interactive"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Edit ${c.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          ) : null}
                          {editHrefId && Number(editHrefId) > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomer(editHrefId, c.name);
                              }}
                              disabled={deletingId === editHrefId}
                              className="h-9 w-9 rounded-full border border-[#fca5a5] bg-[var(--color-white)] text-[var(--color-danger-text)] inline-flex items-center justify-center btn-destructive-press disabled:opacity-60"
                              onMouseDown={(e) => e.stopPropagation()}
                              aria-label={`Delete ${c.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteError ? (
        <div className="text-sm text-[var(--color-danger-text)] bg-[var(--color-danger-bg)] border border-[var(--color-border)] rounded-[14px] px-4 py-3">
          {deleteError}
        </div>
      ) : null}
    </div>
  );
}
