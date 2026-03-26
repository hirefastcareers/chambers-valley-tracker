"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOptimisticCustomers } from "@/components/OptimisticCustomersProvider";
import PageHeader from "@/components/PageHeader";

export default function AddCustomerForm() {
  const router = useRouter();
  const optimistic = useOptimisticCustomers();
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

  const inputClass =
    "mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--color-border)] px-[14px] py-[11px] outline-none bg-[var(--color-surface)] text-[var(--color-text)] input-premium text-[15px]";

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

    const tempId = -Math.abs(Date.now());
    optimistic?.prependCustomer({ tempId, name: name.trim() || "New customer", phone: phone.trim() || null });

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, phone, email, notes, tags: selectedTags }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        optimistic?.removePrepended(tempId);
        setError(typeof data?.error === "string" ? data.error : "Could not add customer");
        setBusy(false);
        return;
      }

      const data = await res.json();
      const parsedCustomerId = Number(data?.customerId);
      if (!Number.isFinite(parsedCustomerId)) {
        optimistic?.removePrepended(tempId);
        setError("Server returned an invalid customer id");
        setBusy(false);
        return;
      }

      optimistic?.removePrepended(tempId);
      router.replace(`/customers/${parsedCustomerId}`);
    } catch {
      optimistic?.removePrepended(tempId);
      setError("Could not add customer");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <PageHeader>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text)] leading-tight">Add Customer</h1>
          <button type="button" onClick={() => router.back()} className="shrink-0 btn-header-outline btn-primary-interactive">
            Back
          </button>
        </div>
      </PageHeader>

      {error ? (
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--color-text)]">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="text-sm font-medium text-[var(--color-text)]">
        Address
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className={inputClass} />
      </label>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-sm font-medium text-[var(--color-text)]">
          Phone (UK format)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className={inputClass}
            placeholder="e.g. 07123 456 789"
          />
        </label>
        <label className="text-sm font-medium text-[var(--color-text)]">
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className={inputClass}
            placeholder="name@example.com"
          />
        </label>
      </div>

      <label className="text-sm font-medium text-[var(--color-text)]">
        Notes / preferences
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className={inputClass}
          placeholder="Any preferences or notes..."
        />
      </label>

      <div>
        <div className="text-sm font-medium text-[var(--color-text)]">Tags</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => {
            const active = selectedTags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={[
                  "px-3 py-2 rounded-[10px] text-xs font-semibold border active:scale-[0.98]",
                  active
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]",
                ].join(" ")}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-[var(--color-text-muted)] block">
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
              className={inputClass}
              placeholder="Type and press Enter"
            />
          </label>
          {customTagInput.trim() ? (
            <button
              type="button"
              onClick={addCustomTag}
              className="mt-2 px-3 py-2 rounded-[10px] bg-[var(--color-primary)] text-white text-xs font-semibold btn-primary-interactive"
            >
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
                  className="px-2 py-1 rounded-full text-xs font-semibold border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] active:scale-[0.98]"
                >
                  {t} <span className="ml-1 text-[var(--color-text-muted)]">×</span>
                </button>
              ))}
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="rounded-[12px] bg-[var(--color-accent)] text-white py-[13px] text-[15px] font-semibold disabled:opacity-60 btn-primary-interactive"
      >
        {busy ? "Adding..." : "Add Customer"}
      </button>
    </form>
  );
}
