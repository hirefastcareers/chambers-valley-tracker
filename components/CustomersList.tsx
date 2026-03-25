"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY, formatMoneyGBP, toWhatsAppInternational } from "@/lib/format";

type CustomerRow = {
  id: number | string;
  name: string;
  phone: string | null;
  next_follow_up_date: string | null;
  tags?: string[] | null;
};

export default function CustomersList() {
  const router = useRouter();
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

    // Avoid hammering the API: load on initial and on debounce-ish delay.
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

  async function deleteCustomer(customerId: string, customerName: string) {
    if (deletingId) return;
    const ok = window.confirm(
      `Delete ${customerName}? This will also delete their jobs, photos, and follow-ups.`
    );
    if (!ok) return;

    setDeletingId(customerId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (res.ok) {
        // Trigger re-fetch; easiest is a route refresh + re-render of this list.
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => null);
      const msg = typeof data?.error === "string" ? data.error : "Could not delete customer";
      setDeleteError(msg);
    } catch {
      setDeleteError("Could not delete customer");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#2d6a4f]">Customers</h1>
        <Link
          href="/customers/new"
          className="rounded-2xl bg-[#52b788] text-white px-4 py-3 text-sm font-semibold shadow-sm active:scale-[0.98]"
        >
          Add Customer
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <label className="text-xs font-medium text-zinc-600">Search</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email..."
          className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]"
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="text-xs font-medium text-zinc-600 mb-2">Filter by tags</div>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => {
            const active = selectedTag === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTag((prev) => (prev === t ? null : t))}
                className={[
                  "px-3 py-2 rounded-xl text-xs font-semibold border active:scale-[0.98]",
                  active ? "bg-[#2d6a4f] text-white border-[#2d6a4f]" : "bg-white text-zinc-800 border-zinc-200",
                ].join(" ")}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="text-xs font-medium text-zinc-600 mb-2">Filter jobs by status</div>
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
                  "px-3 py-2 rounded-xl text-xs font-semibold border active:scale-[0.98]",
                  active ? "bg-[#2d6a4f] text-white border-[#2d6a4f]" : "bg-white text-zinc-800 border-zinc-200",
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
            <div className="text-sm text-zinc-600">Loading jobs...</div>
          ) : jobsRows.length === 0 ? (
            <div className="text-sm text-zinc-600">No matching jobs found.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobsRows.map((r) => (
                <div key={String(r.job_id)} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 truncate">{r.customer_name}</div>
                      <div className="text-sm text-zinc-700 mt-1">{r.job_type}</div>
                      <div className="text-xs text-zinc-600 mt-1">
                        Date: {r.date_done ? formatDateDDMMYYYY(r.date_done) : "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-zinc-900">{formatMoneyGBP(r.quote_amount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="text-sm text-zinc-600">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="text-sm text-zinc-600">No customers found.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {customers.map((c) => {
              const idStr = typeof c.id === "string" ? c.id : String(c.id);
              const editHrefId = idStr && Number.isFinite(Number(idStr)) ? idStr : "";
              const whatsapp = c.phone ? toWhatsAppInternational(c.phone) : "";
              const href = editHrefId ? `/customers/${editHrefId}` : null;
              const canNavigate = Boolean(href);
              const onCardNavigate = () => {
                if (!canNavigate || !href) return;
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
                    "rounded-2xl border border-zinc-200 bg-white p-4",
                    canNavigate ? "cursor-pointer active:scale-[0.99]" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 truncate">{c.name}</div>
                      <div className="text-sm text-zinc-700 mt-2">
                        {c.phone ? (
                          <a
                            href={`https://wa.me/${whatsapp}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2d6a4f] font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-zinc-500">No phone</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-600 mt-2">
                        Next follow-up:{" "}
                        {c.next_follow_up_date ? formatDateDDMMYYYY(c.next_follow_up_date) : "—"}
                      </div>
                      {Array.isArray(c.tags) && c.tags.length ? (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {c.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border border-zinc-200 bg-zinc-50 text-zinc-700"
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
                          className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-[#2d6a4f] bg-white active:scale-[0.99]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Edit
                        </Link>
                      ) : (
                        <div className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-400 bg-white">
                          Edit
                        </div>
                      )}

                      {editHrefId ? (
                        <button
                          type="button"
                          onClick={() => deleteCustomer(editHrefId, c.name)}
                          disabled={deletingId === editHrefId}
                          className="px-3 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-700 bg-white active:scale-[0.99] disabled:opacity-60"
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
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          {deleteError}
        </div>
      ) : null}
    </div>
  );
}

