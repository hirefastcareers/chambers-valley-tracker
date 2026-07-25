"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import PageHeader from "@/components/PageHeader";
import ThemeToggle from "@/components/ThemeToggle";

const TRADE_TYPES = ["gardening", "window cleaning", "cleaning", "handyman", "tree surgery", "other"] as const;

const JOB_TYPE_OPTIONS = [
  "Lawn Mow",
  "Lawn Treatment",
  "Hedge Trim",
  "Edge & Border Trim",
  "Weeding",
  "Planting",
  "Pruning & Deadheading",
  "Garden Clearance",
  "Waste Removal",
  "Turfing",
  "Scarifying & Aeration",
  "Pressure Washing",
  "Jet Washing Paths & Patios",
  "Leaf Clearance",
  "Tree Work",
  "Fencing & Gates",
  "Decking & Patio",
  "Seasonal Tidy",
  "Spring Clean",
  "Autumn Tidy",
  "One-off Tidy",
  "Other",
] as const;

type JobTemplateRow = {
  id: number;
  name: string;
  job_type: string;
  description: string | null;
  default_amount: string | number | null;
  time_of_day: "am" | "pm" | "all_day";
};

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

function formatTradeType(value: string): string {
  const normalised = value.trim().toLowerCase();
  return normalised.charAt(0).toUpperCase() + normalised.slice(1);
}

function subscriptionLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past due";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [tradeType, setTradeType] = useState("gardening");
  const [homePostcode, setHomePostcode] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("350");
  const [subscriptionStatus, setSubscriptionStatus] = useState("trialing");
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [testingNotify, setTestingNotify] = useState(false);
  const [notifyTestResult, setNotifyTestResult] = useState<string | null>(null);

  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AddressAuditResult | null>(null);

  const [templates, setTemplates] = useState<JobTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateJobType, setTemplateJobType] = useState<string>(JOB_TYPE_OPTIONS[0]);
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateAmount, setTemplateAmount] = useState("");
  const [templateTimeOfDay, setTemplateTimeOfDay] = useState<"am" | "pm" | "all_day">("all_day");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/job-templates");
      const data = await res.json();
      if (res.ok && Array.isArray(data?.templates)) {
        setTemplates(
          data.templates.map((t: Record<string, unknown>) => ({
            id: Number(t.id),
            name: String(t.name ?? ""),
            job_type: String(t.job_type ?? ""),
            description: t.description == null ? null : String(t.description),
            default_amount: t.default_amount as string | number | null,
            time_of_day: (["am", "pm", "all_day"].includes(String(t.time_of_day))
              ? String(t.time_of_day)
              : "all_day") as "am" | "pm" | "all_day",
          }))
        );
      }
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  function resetTemplateForm() {
    setTemplateFormOpen(false);
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateJobType(JOB_TYPE_OPTIONS[0]);
    setTemplateDescription("");
    setTemplateAmount("");
    setTemplateTimeOfDay("all_day");
    setTemplateError(null);
  }

  function openAddTemplate() {
    resetTemplateForm();
    setTemplateFormOpen(true);
  }

  function openEditTemplate(t: JobTemplateRow) {
    setEditingTemplateId(t.id);
    setTemplateName(t.name);
    setTemplateJobType(t.job_type);
    setTemplateDescription(t.description ?? "");
    setTemplateAmount(t.default_amount == null ? "" : String(t.default_amount));
    setTemplateTimeOfDay(t.time_of_day);
    setTemplateFormOpen(true);
    setTemplateError(null);
  }

  async function saveTemplate() {
    if (!templateName.trim() || !templateJobType.trim()) {
      setTemplateError("Name and job type are required");
      return;
    }
    setTemplateSaving(true);
    setTemplateError(null);
    try {
      const payload = {
        name: templateName.trim(),
        job_type: templateJobType,
        description: templateDescription.trim(),
        default_amount: templateAmount.trim() || null,
        time_of_day: templateTimeOfDay,
      };
      const res = await fetch(
        editingTemplateId ? `/api/job-templates/${editingTemplateId}` : "/api/job-templates",
        {
          method: editingTemplateId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setTemplateError(typeof data?.error === "string" ? data.error : "Could not save template");
        return;
      }
      resetTemplateForm();
      await loadTemplates();
    } catch {
      setTemplateError("Could not save template");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function deleteTemplate(id: number) {
    if (!window.confirm("Delete this template?")) return;
    const res = await fetch(`/api/job-templates/${id}`, { method: "DELETE" });
    if (res.ok) await loadTemplates();
  }

  const inputClass =
    "mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--c-border)] px-[14px] py-[11px] bg-[var(--c-surface)] text-[var(--c-text)]";

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (res.ok) {
          setBusinessName(String(data.business_name ?? ""));
          setTradeType(String(data.trade_type ?? "gardening").toLowerCase());
          setHomePostcode(String(data.home_postcode ?? ""));
          setWeeklyTarget(String(data.weekly_target ?? "350"));
          setSubscriptionStatus(String(data.subscription_status ?? "trialing"));
          setHasStripeCustomer(Boolean(data.stripe_customer_id));
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
          business_name: businessName,
          trade_type: tradeType,
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

  async function openBillingPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(typeof data?.error === "string" ? data.error : "Could not open billing portal");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal");
    } finally {
      setPortalLoading(false);
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
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle className="h-9 w-9" />
            <button type="button" onClick={() => router.back()} className="btn-header-outline btn-primary-interactive">
              Back
            </button>
            <UserButton />
          </div>
        </div>
      </PageHeader>

      {!loaded ? <div className="text-sm text-[var(--c-text-muted)]">Loading settings...</div> : null}
      {error ? <div className="text-sm text-[var(--c-danger)]">{error}</div> : null}

      <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 flex flex-col gap-3">
        <div className="text-[15px] font-semibold text-[var(--c-text)]">Appearance</div>
        <p className="text-[13px] text-[var(--c-text-muted)] leading-snug">Switch between light and dark mode.</p>
        <div className="flex items-center gap-3">
          <ThemeToggle className="h-10 w-10" />
          <span className="text-[13px] text-[var(--c-text-muted)]">Dark mode</span>
        </div>
      </div>

      <label className="text-sm font-medium text-[var(--c-text)]">
        Business name
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className={inputClass}
          placeholder="Chambers Valley Garden Care"
        />
      </label>

      <label className="text-sm font-medium text-[var(--c-text)]">
        Trade type
        <select
          value={tradeType}
          onChange={(e) => setTradeType(e.target.value)}
          className={inputClass}
        >
          {TRADE_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatTradeType(t)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-[var(--c-text)]">
        Home postcode
        <input
          value={homePostcode}
          onChange={(e) => setHomePostcode(e.target.value)}
          className={inputClass}
          placeholder="e.g. S35 1AA"
        />
      </label>

      <label className="text-sm font-medium text-[var(--c-text)]">
        Weekly earnings target (£)
        <input
          inputMode="decimal"
          value={weeklyTarget}
          onChange={(e) => setWeeklyTarget(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-[var(--c-text)]">Job templates</div>
          {!templateFormOpen ? (
            <button
              type="button"
              onClick={openAddTemplate}
              className="rounded-[8px] border border-[var(--c-border-strong)] px-3 py-1.5 text-[13px] font-semibold text-[var(--c-text)]"
            >
              Add template
            </button>
          ) : null}
        </div>
        <p className="text-[13px] text-[var(--c-text-muted)] leading-snug">
          Save common job setups to pre-fill the Add Job form.
        </p>
        {templateFormOpen ? (
          <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--c-border)] p-3">
            <label className="text-sm font-medium text-[var(--c-text)]">
              Template name
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className={inputClass} placeholder="Standard lawn mow" />
            </label>
            <label className="text-sm font-medium text-[var(--c-text)]">
              Job type
              <select value={templateJobType} onChange={(e) => setTemplateJobType(e.target.value)} className={inputClass}>
                {JOB_TYPE_OPTIONS.map((jt) => (
                  <option key={jt} value={jt}>
                    {jt}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-[var(--c-text)]">
              Description (optional)
              <textarea value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} rows={2} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-[var(--c-text)]">
              Default amount (optional)
              <input inputMode="decimal" value={templateAmount} onChange={(e) => setTemplateAmount(e.target.value)} className={inputClass} placeholder="e.g. 35" />
            </label>
            <label className="text-sm font-medium text-[var(--c-text)]">
              Time of day
              <select value={templateTimeOfDay} onChange={(e) => setTemplateTimeOfDay(e.target.value as "am" | "pm" | "all_day")} className={inputClass}>
                <option value="am">AM</option>
                <option value="pm">PM</option>
                <option value="all_day">All day</option>
              </select>
            </label>
            {templateError ? <div className="text-sm text-[var(--c-danger)]">{templateError}</div> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => void saveTemplate()} disabled={templateSaving} className="flex-1 btn-primary-solid disabled:opacity-60">
                {templateSaving ? "Saving…" : editingTemplateId ? "Save changes" : "Save template"}
              </button>
              <button type="button" onClick={resetTemplateForm} className="rounded-[10px] border border-[var(--c-border-strong)] px-4 py-3 text-[13px] font-semibold text-[var(--c-text)]">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {templatesLoading ? (
          <div className="text-[13px] text-[var(--c-text-muted)]">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="text-[13px] text-[var(--c-text-muted)]">No templates yet.</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.map((t) => (
              <li key={t.id} className="rounded-[10px] border border-[var(--c-border)] px-3 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--c-text)]">{t.name}</div>
                  <div className="text-[12px] text-[var(--c-text-muted)] mt-0.5">{t.job_type}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEditTemplate(t)} className="text-[12px] font-semibold text-[var(--c-text)]">
                    Edit
                  </button>
                  <button type="button" onClick={() => void deleteTemplate(t.id)} className="text-[12px] font-semibold text-[var(--c-danger)]">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 flex flex-col gap-3">
        <div className="text-[15px] font-semibold text-[var(--c-text)]">Subscription</div>
        <div className="text-[13px] text-[var(--c-text-muted)]">
          Status: <span className="font-semibold text-[var(--c-text)]">{subscriptionLabel(subscriptionStatus)}</span>
        </div>
        {hasStripeCustomer ? (
          <button
            type="button"
            disabled={portalLoading || !loaded}
            onClick={() => void openBillingPortal()}
            className="w-full rounded-[10px] border-[1.5px] border-[var(--c-border-strong)] px-4 py-[12px] text-[13px] font-semibold text-[var(--c-text)] disabled:opacity-60"
          >
            {portalLoading ? "Opening…" : "Manage subscription"}
          </button>
        ) : (
          <p className="text-[13px] text-[var(--c-text-muted)] leading-snug">
            Subscribe from the billing page when your trial ends.
          </p>
        )}
      </div>

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
                    <Link href={`/customers/${issue.id}`} className="font-semibold text-[var(--c-info)] underline">
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
