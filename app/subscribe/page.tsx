"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSubscription() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(typeof data?.error === "string" ? data.error : "Could not start checkout");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--c-bg)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[17px] font-semibold text-[var(--c-text)] tracking-tight">Patch</span>
          <UserButton />
        </div>

        <h1 className="text-[22px] font-semibold text-[var(--c-text)]">Your 14-day trial has ended</h1>
        <p className="text-[13px] text-[var(--c-text-muted)] mt-2">
          Subscribe to keep tracking jobs, follow-ups, earnings, and daily notifications.
        </p>

        <div className="mt-6 rounded-[10px] border border-[var(--c-border)] bg-[var(--c-bg)] px-4 py-4">
          <div className="text-[28px] font-semibold text-[var(--c-text)]">£4.99</div>
          <div className="text-[13px] text-[var(--c-text-muted)]">per month</div>
        </div>

        {error ? <div className="mt-4 text-sm text-[var(--c-danger)]">{error}</div> : null}

        <button
          type="button"
          onClick={() => void startSubscription()}
          disabled={loading}
          className="mt-6 w-full btn-primary-solid !py-[14px] disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Start subscription"}
        </button>

        <div className="mt-6">
          <div className="text-[13px] font-semibold text-[var(--c-text)] mb-2">What&apos;s included</div>
          <ul className="text-[13px] text-[var(--c-text-muted)] flex flex-col gap-2 list-disc pl-5">
            <li>Customer and job tracking</li>
            <li>Follow-ups and recurring reminders</li>
            <li>Weekly earnings targets and exports</li>
            <li>Photo gallery and Facebook post helper</li>
            <li>Daily push notification digest</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
