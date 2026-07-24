"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TRADE_TYPES = [
  "Gardening",
  "Window Cleaning",
  "Cleaning",
  "Handyman",
  "Tree Surgery",
  "Other",
] as const;

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [tradeType, setTradeType] = useState<string>("Gardening");
  const [homePostcode, setHomePostcode] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("350");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function completeOnboarding() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          trade_type: tradeType,
          home_postcode: homePostcode.trim().toUpperCase(),
          weekly_target: Number(weeklyTarget),
          onboarding_completed: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not save onboarding");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not save onboarding");
    } finally {
      setSaving(false);
    }
  }

  function onNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step === 1) {
      if (!businessName.trim()) {
        setError("Business name is required");
        return;
      }
      setStep(2);
      return;
    }
    if (!UK_POSTCODE.test(homePostcode.trim())) {
      setError("Enter a valid UK postcode (e.g. S35 1AA)");
      return;
    }
    const target = Number(weeklyTarget);
    if (!Number.isFinite(target) || target <= 0) {
      setError("Enter a valid weekly earnings target");
      return;
    }
    void completeOnboarding();
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--c-bg)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-[var(--c-text-muted)] mb-2">
            Step {step} of 2
          </div>
          <h1 className="text-[22px] font-semibold text-[var(--c-text)]">
            {step === 1 ? "Your business" : "Location & targets"}
          </h1>
          <p className="text-[13px] text-[var(--c-text-muted)] mt-2">
            {step === 1
              ? "Tell us about your trade business so Patch can personalise your tracker."
              : "Set your home base and weekly earnings goal."}
          </p>
        </div>

        {error ? <div className="mb-4 text-sm text-[var(--c-danger)]">{error}</div> : null}

        <form onSubmit={onNext} className="flex flex-col gap-4">
          {step === 1 ? (
            <>
              <label className="text-sm font-medium text-[var(--c-text)]">
                Business name
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--c-border)] px-[14px] py-[11px] bg-[var(--c-surface)] text-[var(--c-text)]"
                  placeholder="Chambers Valley Garden Care"
                />
              </label>
              <label className="text-sm font-medium text-[var(--c-text)]">
                Trade type
                <select
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--c-border)] px-[14px] py-[11px] bg-[var(--c-surface)] text-[var(--c-text)]"
                >
                  {TRADE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="text-sm font-medium text-[var(--c-text)]">
                Home postcode
                <input
                  value={homePostcode}
                  onChange={(e) => setHomePostcode(e.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--c-border)] px-[14px] py-[11px] bg-[var(--c-surface)] text-[var(--c-text)]"
                  placeholder="S35 1AA"
                />
              </label>
              <label className="text-sm font-medium text-[var(--c-text)]">
                Weekly earnings target (£)
                <input
                  inputMode="decimal"
                  value={weeklyTarget}
                  onChange={(e) => setWeeklyTarget(e.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--c-border)] px-[14px] py-[11px] bg-[var(--c-surface)] text-[var(--c-text)]"
                />
              </label>
            </>
          )}

          <div className="flex gap-3 mt-2">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-[10px] border-[1.5px] border-[var(--c-border-strong)] px-4 py-[12px] text-[13px] font-semibold text-[var(--c-text)]"
              >
                Back
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary-solid !py-[14px] disabled:opacity-60"
            >
              {saving ? "Saving…" : step === 1 ? "Continue" : "Finish setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
