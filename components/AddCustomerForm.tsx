"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCustomerForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const TAG_OPTIONS = ["Regular", "One-off", "Needs chasing", "VIP", "Seasonal"] as const;
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function addCustomTag() {
    const t = customTagInput.trim();
    if (!t) return;
    setSelectedTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setCustomTagInput("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, phone, email, notes, tags: selectedTags }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Could not add customer");
        setBusy(false);
        return;
      }

      const data = await res.json();
      const parsedCustomerId = Number(data?.customerId);
      if (!Number.isFinite(parsedCustomerId)) {
        setError("Server returned an invalid customer id");
        setBusy(false);
        return;
      }

      router.replace(`/customers/${parsedCustomerId}`);
    } catch {
      setError("Could not add customer");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#2d6a4f]">Add Customer</h1>
        <button type="button" onClick={() => router.back()} className="px-3 py-2 rounded-xl border border-zinc-200">
          Back
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
        </label>
      </div>

      <label className="text-sm font-medium text-zinc-700">
        Address
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
      </label>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-sm font-medium text-zinc-700">
          Phone (UK format)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" placeholder="e.g. 07123 456 789" />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" placeholder="name@example.com" />
        </label>
      </div>

      <label className="text-sm font-medium text-zinc-700">
        Notes / preferences
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" placeholder="Any preferences or notes..." />
      </label>

      <div>
        <div className="text-sm font-medium text-zinc-700">Tags</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => {
            const active = selectedTags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
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

        <div className="mt-3">
          <label className="text-xs font-medium text-zinc-600 block">
            Custom tag
            <input
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]"
              placeholder="Type and press Enter"
            />
          </label>
          {customTagInput.trim() ? (
            <button type="button" onClick={addCustomTag} className="mt-2 px-3 py-2 rounded-xl bg-[#2d6a4f] text-white text-xs font-semibold active:scale-[0.98]">
              Add tag
            </button>
          ) : null}
        </div>

        {selectedTags.filter((t) => !TAG_OPTIONS.includes(t as (typeof TAG_OPTIONS)[number])).length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedTags
              .filter((t) => !TAG_OPTIONS.includes(t as (typeof TAG_OPTIONS)[number]))
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className="px-2 py-1 rounded-full text-xs font-semibold border border-zinc-200 bg-white text-zinc-800 active:scale-[0.98]"
                >
                  {t} <span className="ml-1 text-zinc-400">×</span>
                </button>
              ))}
          </div>
        ) : null}
      </div>

      <button type="submit" disabled={busy || !name.trim()} className="rounded-2xl bg-[#2d6a4f] text-white py-3 text-base font-semibold disabled:opacity-60 active:scale-[0.99]">
        {busy ? "Adding..." : "Add Customer"}
      </button>
    </form>
  );
}

