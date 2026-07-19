"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

type AddressIssue = {
  id: number;
  name: string;
  address: string | null;
  issue: string;
};

type AddressAuditResult = {
  ok?: boolean;
  total_customers: number;
  verified: number;
  issues: AddressIssue[];
  geocoded?: number;
  error?: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [homePostcode, setHomePostcode] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("350");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [testingNotify, setTestingNotify] = useState(false);
  const [notifyTestResult, setNotifyTestResult] = useState<string | null>(null);

  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AddressAuditResult | null>(null);

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

  async function runAddressAudit() {
    setAuditBusy(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/audit-addresses", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as AddressAuditResult | null;
      if (!res.ok || !data) {
        setAuditError(data?.error ? String(data.error) : `Audit failed (${res.status})`);
        setAuditResult(null);
        return;
      }
      setAuditResult(data);
    } catch {
      setAuditError("Audit failed");
      setAuditResult(null);
    } finally {
      setAuditBusy(false);
    }
  }

  const allVerified =
    auditResult != null && auditResult.total_customers > 0 && auditResult.issues.length === 0;
  const hasIssues = auditResult != null && auditResult.issues.length > 0;

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

      <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 flex flex-col gap-3">
        <div className="text-[15px] font-semibold text-[var(--c-text)]">Address audit</div>
        <p className="text-[13px] text-[var(--c-text-muted)] leading-snug">
          Checks every customer has an address and map coordinates. Missing coordinates are geocoded automatically when possible.
        </p>
        {auditError ? <div className="text-sm text-[var(--c-danger)]">{auditError}</div> : null}
        {auditResult ? (
          <div className="flex flex-col gap-2">
            <div
              className={[
                "flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[13px] leading-snug",
                allVerified
                  ? "border-[rgba(22,163,74,0.35)] bg-[rgba(22,163,74,0.08)] text-[var(--c-text)]"
                  : hasIssues
                    ? "border-[rgba(217,119,6,0.4)] bg-[rgba(217,119,6,0.1)] text-[var(--c-text)]"
                    : "border-[var(--c-border)] text-[var(--c-text)]",
              ].join(" ")}
            >
              <span className="text-[16px] leading-none shrink-0" aria-hidden>
                {allVerified ? "✓" : hasIssues ? "⚠" : "·"}
              </span>
              <span>
                {auditResult.verified} of {auditResult.total_customers} customers have verified addresses
                {typeof auditResult.geocoded === "number" && auditResult.geocoded > 0
                  ? ` (${auditResult.geocoded} newly geocoded)`
                  : ""}
              </span>
            </div>
            {hasIssues ? (
              <ul className="flex flex-col gap-2 mt-1">
                {auditResult.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className="rounded-[10px] border border-[var(--c-border)] px-3 py-2.5 text-[13px]"
                  >
                    <Link
                      href={`/customers/${issue.id}`}
                      className="font-semibold text-[var(--c-info)] underline"
                    >
                      {issue.name}
                    </Link>
                    <div className="mt-0.5 text-[var(--c-text-muted)]">{issue.issue}</div>
                    {issue.address ? (
                      <div className="mt-0.5 text-[var(--c-text-subtle)]">{issue.address}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={auditBusy || !loaded}
          onClick={() => void runAddressAudit()}
          className="w-full rounded-[10px] border-[1.5px] border-[var(--c-border-strong)] px-4 py-[12px] text-[13px] font-semibold text-[var(--c-text)] disabled:opacity-60"
        >
          {auditBusy ? "Running audit…" : "Run address audit"}
        </button>
      </div>

      <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 flex flex-col gap-3">
        <div className="text-[15px] font-semibold text-[var(--c-text)]">Push notifications</div>
        <p className="text-[13px] text-[var(--c-text-muted)] leading-snug">
          Sends the same digest as the morning cron: today&apos;s jobs (with totals and slots), overdue follow-ups, or a short “day off” message when everything is clear.
        </p>
        {notifyTestResult ? <div className="text-sm text-[var(--c-text-muted)] whitespace-pre-line">{notifyTestResult}</div> : null}
        <button
          type="button"
          disabled={testingNotify || !loaded}
          onClick={() => {
            void (async () => {
              setTestingNotify(true);
              setNotifyTestResult(null);
              try {
                const res = await fetch("/api/send-daily-notifications", {
                  method: "POST",
                  credentials: "include",
                });
                const data = (await res.json().catch(() => null)) as {
                  ok?: boolean;
                  sent?: boolean;
                  reason?: string;
                  error?: string;
                  message?: string;
                } | null;
                if (!res.ok) {
                  setNotifyTestResult(data?.error ? String(data.error) : `Request failed (${res.status})`);
                  return;
                }
                if (data?.sent && data.message) {
                  setNotifyTestResult(`Sent:\n${data.message}`);
                } else if (data?.sent) {
                  setNotifyTestResult("Sent.");
                } else {
                  setNotifyTestResult("Done.");
                }
              } catch {
                setNotifyTestResult("Request failed.");
              } finally {
                setTestingNotify(false);
              }
            })();
          }}
          className="w-full rounded-[10px] border-[1.5px] border-[var(--c-border-strong)] px-4 py-[12px] text-[13px] font-semibold text-[var(--c-text)] disabled:opacity-60"
        >
          {testingNotify ? "Sending…" : "Send test notification"}
        </button>
      </div>
    </form>
  );
}
