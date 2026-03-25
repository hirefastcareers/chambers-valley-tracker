"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDateDDMMYYYY, toWhatsAppInternational } from "@/lib/format";

type CustomerRow = {
  id: number;
  name: string;
  phone: string | null;
  next_follow_up_date: string | null;
};

export default function CustomersList() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  const canSearch = useMemo(() => search.trim().length >= 0, [search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("search", search.trim());
        const res = await fetch(`/api/customers?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Avoid hammering the API: load on initial and on debounce-ish delay.
    if (!canSearch) return;
    const t = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, canSearch]);

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

      <div className="overflow-y-auto pb-4">
        {loading ? (
          <div className="text-sm text-zinc-600">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="text-sm text-zinc-600">No customers found.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {customers.map((c) => {
              const whatsapp = c.phone ? toWhatsAppInternational(c.phone) : "";
              return (
                <div key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
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
                          >
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-zinc-500">No phone</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-600 mt-2">
                        Next follow-up:{" "}
                        {c.next_follow_up_date
                          ? formatDateDDMMYYYY(c.next_follow_up_date)
                          : "—"}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <Link
                        href={`/customers/${c.id}`}
                        className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-[#2d6a4f] bg-white active:scale-[0.99]"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

