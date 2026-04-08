"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

export default function SettingsPage() {
  const router = useRouter();
  const [homePostcode, setHomePostcode] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("350");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (res.ok) {
          setHomePostcode(String(data.home_postcode ?? ""));
          setWeeklyTarget(String(data.weekly_target ?? "350"));
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_postcode: homePostcode,
          weekly_target: weeklyTarget,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Could not save settings");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="flex flex-col gap-6">
      <PageHeader>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[22px] font-semibold text-[var(--c-text)] leading-tight">Settings</h1>
          <button type="button" onClick={() => router.back()} className="shrink-0 btn-header-outline btn-primary-interactive">
            Back
          </button>
        </div>
      </PageHeader>

      {!loaded ? <div className="text-sm text-[var(--c-text-muted)]">Loading settings...</div> : null}
      {error ? <div className="text-sm text-[var(--c-danger)]">{error}</div> : null}

      <label className="text-sm font-medium text-[var(--c-text)]">
        Home postcode
        <input
          value={homePostcode}
          onChange={(e) => setHomePostcode(e.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--c-border)] px-[14px] py-[11px] bg-[var(--c-surface)] text-[var(--c-text)]"
          placeholder="e.g. S35 1AA"
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

      <button type="submit" disabled={saving} className="w-full btn-primary-solid !py-[14px] disabled:opacity-60">
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

