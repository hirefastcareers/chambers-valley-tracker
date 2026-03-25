"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import MarkRecurringDoneButton from "@/components/MarkRecurringDoneButton";
import { formatDateDDMMYYYY, formatMoneyGBP, toWhatsAppInternational } from "@/lib/format";
import type { JobStatus } from "@/lib/status";

type Customer = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type FollowUp = {
  id: number;
  follow_up_date: string;
  notes: string | null;
  completed: boolean;
};

type RecurringReminder = {
  id: number;
  job_type: string;
  interval_days: number;
  last_done_date: string | null;
  next_due_date: string;
  active: boolean;
};

type Photo = {
  id: number;
  cloudinary_url: string;
  type: "before" | "after";
};

type JobWithPhotos = {
  id: number;
  job_type: string;
  description: string | null;
  status: JobStatus;
  quote_amount: string | number | null;
  paid: boolean;
  date_done: string | null;
  photos: Photo[];
};

export default function CustomerDetail({
  customer,
  latestJob,
  nextFollowUpDate,
  followUps,
  recurringReminders,
  jobHistory,
}: {
  customer: Customer;
  latestJob: JobWithPhotos | null;
  nextFollowUpDate: string | null;
  followUps: FollowUp[];
  recurringReminders: RecurringReminder[];
  jobHistory: JobWithPhotos[];
}) {
  const router = useRouter();

  const whatsapp = useMemo(() => {
    if (!customer.phone) return "";
    return toWhatsAppInternational(customer.phone);
  }, [customer.phone]);

  const [editingContact, setEditingContact] = useState(false);
  const [contact, setContact] = useState(() => ({
    name: customer.name,
    address: customer.address ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
  }));

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(customer.notes ?? "");

  // Follow-up inline editing (reuses the existing follow-up form).
  const [editingFollowUpId, setEditingFollowUpId] = useState<number | null>(null);
  const [editingFollowUpCompleted, setEditingFollowUpCompleted] = useState<boolean>(false);
  const [deletingFollowUpId, setDeletingFollowUpId] = useState<number | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [followUpDate, setFollowUpDate] = useState(() => {
    return nextFollowUpDate ?? new Date().toISOString().slice(0, 10);
  });
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [recurringJobType, setRecurringJobType] = useState("Monthly mow");
  const [recurringIntervalDays, setRecurringIntervalDays] = useState("28");

  async function saveContact() {
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contact.name,
        address: contact.address,
        phone: contact.phone,
        email: contact.email,
        notes: notes,
      }),
    });

    if (res.ok) {
      setEditingContact(false);
      router.refresh();
    }
  }

  async function saveNotes() {
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contact.name,
        address: contact.address,
        phone: contact.phone,
        email: contact.email,
        notes: notes,
      }),
    });
    if (res.ok) {
      setEditingNotes(false);
      router.refresh();
    }
  }

  async function upsertFollowUp(e: React.FormEvent) {
    e.preventDefault();

    // When editing, save with PUT for this follow-up id.
    if (editingFollowUpId !== null) {
      const res = await fetch(`/api/follow-ups/${editingFollowUpId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpDate,
          notes: followUpNotes,
          completed: editingFollowUpCompleted,
        }),
      });
      if (res.ok) {
        setEditingFollowUpId(null);
        setFollowUpNotes("");
        router.refresh();
      }
      return;
    }

    // Default behaviour: upsert for the customer (keeps one open follow-up record).
    const res = await fetch("/api/follow-ups/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        followUpDate,
        notes: followUpNotes,
      }),
    });
    if (res.ok) {
      setFollowUpNotes("");
      router.refresh();
    }
  }

  async function deleteCustomer() {
    if (deleting) return;
    const ok = window.confirm(
      `Delete ${customer.name}? This will also delete their jobs, photos, and follow-ups.`
    );
    if (!ok) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      if (res.ok) {
        router.replace("/customers");
        return;
      }

      const data = await res.json().catch(() => null);
      const msg =
        typeof data?.error === "string" ? data.error : "Could not delete customer";
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function addRecurringReminder(e: React.FormEvent) {
    e.preventDefault();
    const interval = Number(recurringIntervalDays);
    const res = await fetch("/api/recurring-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        jobType: recurringJobType,
        intervalDays: interval,
      }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  async function markFollowUpDone(followUpId: number) {
    const res = await fetch(`/api/follow-ups/${followUpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    if (res.ok) router.refresh();
  }

  function beginEditFollowUp(f: FollowUp) {
    setEditingFollowUpId(f.id);
    setEditingFollowUpCompleted(f.completed);
    setFollowUpDate(f.follow_up_date);
    setFollowUpNotes(f.notes ?? "");
  }

  async function deleteFollowUp(followUpId: number) {
    if (deletingFollowUpId !== null) return;
    const ok = window.confirm("Delete this follow-up?");
    if (!ok) return;

    setDeletingFollowUpId(followUpId);
    try {
      const res = await fetch(`/api/follow-ups/${followUpId}`, { method: "DELETE" });
      if (res.ok) {
        if (editingFollowUpId === followUpId) setEditingFollowUpId(null);
        router.refresh();
      }
    } finally {
      setDeletingFollowUpId(null);
    }
  }

  function openAddJobSheet() {
    const url = new URL(window.location.href);
    url.searchParams.set("add_job", "1");
    url.searchParams.set("customerId", String(customer.id));
    router.push(url.pathname + url.search);
  }

  const upcoming = followUps.filter((f) => !f.completed).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
  const past = followUps.filter((f) => f.completed).sort((a, b) => b.follow_up_date.localeCompare(a.follow_up_date));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[#2d6a4f] truncate">{customer.name}</h1>
          <div className="text-sm text-zinc-600 mt-1">
            {customer.phone ? `Phone: ${customer.phone}` : "No phone on file"}
          </div>
        </div>

        <div className="shrink-0">
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-[#52b788] text-white px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 active:scale-[0.99]"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-4.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5z" />
                <path d="M7.5 8.5c1 3 2.5 4.5 5.5 5.5" />
              </svg>
              WhatsApp
            </a>
          ) : (
            <div className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-500 bg-white">
              No WhatsApp
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[#2d6a4f] font-semibold">Contact details</div>
            <button
              type="button"
              onClick={() => setEditingContact((v) => !v)}
              className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold"
            >
              {editingContact ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div>
              <div className="text-xs font-medium text-zinc-600">Name</div>
              {editingContact ? (
                <input value={contact.name} onChange={(e) => setContact((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
              ) : (
                <div className="text-sm text-zinc-900 font-semibold mt-1">{customer.name}</div>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-600">Address</div>
              {editingContact ? (
                <textarea rows={2} value={contact.address} onChange={(e) => setContact((p) => ({ ...p, address: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
              ) : (
                <div className="text-sm text-zinc-700 mt-1">{customer.address ?? "—"}</div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <div className="text-xs font-medium text-zinc-600">Phone</div>
                {editingContact ? (
                  <input value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} inputMode="tel" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
                ) : (
                  <div className="text-sm text-zinc-700 mt-1">{customer.phone ?? "—"}</div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-600">Email</div>
                {editingContact ? (
                  <input value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} inputMode="email" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
                ) : (
                  <div className="text-sm text-zinc-700 mt-1">{customer.email ?? "—"}</div>
                )}
              </div>
            </div>
          </div>

          {editingContact ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={saveContact}
                className="w-full rounded-2xl bg-[#2d6a4f] text-white py-3 text-base font-semibold active:scale-[0.99]"
              >
                Save contact
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[#2d6a4f] font-semibold">Notes / preferences</div>
            <button
              type="button"
              onClick={() => setEditingNotes((v) => !v)}
              className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold"
            >
              {editingNotes ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="mt-3">
            {editingNotes ? (
              <>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]"
                />
                <button
                  type="button"
                  onClick={saveNotes}
                  className="w-full mt-3 rounded-2xl bg-[#52b788] text-white py-3 text-base font-semibold active:scale-[0.99]"
                >
                  Save notes
                </button>
              </>
            ) : (
              <div className="text-sm text-zinc-700 whitespace-pre-wrap">
                {customer.notes ?? "—"}
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={deleteCustomer}
              disabled={deleting}
              className="w-full rounded-2xl bg-red-600 text-white py-3 text-base font-semibold disabled:opacity-60 active:scale-[0.99]"
            >
              {deleting ? "Deleting..." : "Delete customer"}
            </button>
            {deleteError ? (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                {deleteError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-[#2d6a4f] font-semibold">Current status</div>
          <div className="mt-3 flex flex-col gap-3">
            {latestJob ? (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900">{latestJob.job_type}</div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Date done: {latestJob.date_done ? formatDateDDMMYYYY(latestJob.date_done) : "—"}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Follow-up: {nextFollowUpDate ? formatDateDDMMYYYY(nextFollowUpDate) : "—"}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <StatusBadge status={latestJob.status} />
                  <div className="text-sm font-semibold text-zinc-900">{formatMoneyGBP(latestJob.quote_amount)}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-600">No jobs yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[#2d6a4f] font-semibold">Follow-ups</div>
          <div className="text-xs text-zinc-600">Upcoming + past</div>
        </div>

        <form onSubmit={upsertFollowUp} className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="text-sm font-medium text-zinc-700">
              Follow-up date
              <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
            </label>
            <div className="flex flex-col gap-2">
              <button type="submit" className="rounded-2xl bg-[#2d6a4f] text-white py-3 text-base font-semibold active:scale-[0.99]">
                  {editingFollowUpId !== null ? "Update follow-up" : "Save follow-up"}
              </button>
                {editingFollowUpId !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFollowUpId(null);
                      setFollowUpNotes("");
                    }}
                    className="rounded-2xl border border-zinc-200 bg-white text-sm font-semibold py-3 active:scale-[0.99]"
                  >
                    Cancel edit
                  </button>
                ) : null}
            </div>
          </div>

          <label className="text-sm font-medium text-zinc-700">
            Notes
            <textarea value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" placeholder="What should we do next?" />
          </label>
        </form>

        <div className="mt-4 flex flex-col gap-3">
          {upcoming.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-[#2d6a4f] mb-2">Upcoming</div>
              <div className="flex flex-col gap-2">
                {upcoming.map((f) => (
                  <div key={f.id} className="rounded-2xl border border-zinc-200 p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900">
                        Due {formatDateDDMMYYYY(f.follow_up_date)}
                      </div>
                      {f.notes ? <div className="text-sm text-zinc-700 mt-1 overflow-hidden text-ellipsis whitespace-nowrap">{f.notes}</div> : null}
                    </div>
                    <div className="shrink-0 flex flex-row items-center justify-end gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => markFollowUpDone(f.id)}
                        className="px-3 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold active:scale-[0.99]"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => beginEditFollowUp(f)}
                        className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-sm font-semibold active:scale-[0.99]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFollowUp(f.id)}
                        disabled={deletingFollowUpId === f.id}
                        className="px-3 py-2 rounded-xl border border-red-200 bg-white text-red-700 text-sm font-semibold active:scale-[0.99] disabled:opacity-60"
                      >
                        {deletingFollowUpId === f.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {past.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-[#2d6a4f] mb-2 mt-4">Past</div>
              <div className="flex flex-col gap-2">
                {past.map((f) => (
                    <div key={f.id} className="rounded-2xl border border-zinc-200 p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900">
                          {formatDateDDMMYYYY(f.follow_up_date)}
                        </div>
                        {f.notes ? (
                          <div className="text-sm text-zinc-700 mt-1 whitespace-pre-wrap">
                            {f.notes}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 flex flex-row items-center justify-end gap-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => beginEditFollowUp(f)}
                          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-sm font-semibold active:scale-[0.99]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFollowUp(f.id)}
                          disabled={deletingFollowUpId === f.id}
                          className="px-3 py-2 rounded-xl border border-red-200 bg-white text-red-700 text-sm font-semibold active:scale-[0.99] disabled:opacity-60"
                        >
                          {deletingFollowUpId === f.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          ) : null}

          {upcoming.length === 0 && past.length === 0 ? (
            <div className="text-sm text-zinc-600">No follow-ups yet.</div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[#2d6a4f] font-semibold">Recurring reminders</div>
          <div className="text-xs text-zinc-600">Tap “Done” to roll forward</div>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {recurringReminders.length === 0 ? (
            <div className="text-sm text-zinc-600">No recurring reminders yet.</div>
          ) : (
            recurringReminders.map((r) => (
              <div key={r.id} className="rounded-2xl border border-zinc-200 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900">{r.job_type}</div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Every {r.interval_days} days
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Next due: {formatDateDDMMYYYY(r.next_due_date)}
                  </div>
                </div>
                <div className="shrink-0">
                  <MarkRecurringDoneButton reminderId={r.id} />
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={addRecurringReminder} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium text-zinc-700">
              Reminder name / job type
              <input value={recurringJobType} onChange={(e) => setRecurringJobType(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Interval (days)
              <input value={recurringIntervalDays} onChange={(e) => setRecurringIntervalDays(e.target.value)} inputMode="numeric" className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]" />
            </label>
          </div>

          <button type="submit" className="rounded-2xl bg-[#52b788] text-white py-3 text-base font-semibold active:scale-[0.99]">
            Add recurring reminder
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[#2d6a4f] font-semibold">Job history</div>
          <button
            type="button"
            onClick={openAddJobSheet}
            className="rounded-2xl bg-[#2d6a4f] text-white px-4 py-3 text-sm font-semibold active:scale-[0.99]"
          >
            Add Job
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {jobHistory.length === 0 ? (
            <div className="text-sm text-zinc-600">No jobs yet.</div>
          ) : (
            jobHistory.map((j) => {
              const hasBefore = j.photos.some((p) => p.type === "before");
              const hasAfter = j.photos.some((p) => p.type === "after");
              return (
                <details key={j.id} className="rounded-2xl border border-zinc-200 p-3">
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900">{j.job_type}</div>
                        <div className="text-xs text-zinc-600 mt-1">
                          {j.date_done ? `Date: ${formatDateDDMMYYYY(j.date_done)}` : "Date not set"}
                        </div>
                        {j.description ? (
                          <div className="text-sm text-zinc-700 mt-2 overflow-hidden text-ellipsis whitespace-nowrap">
                            {j.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <StatusBadge status={j.status} />
                        <div className="text-sm font-semibold text-zinc-900">
                          {formatMoneyGBP(j.quote_amount)}
                        </div>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-3 flex flex-col gap-3">
                    <div className="text-sm text-zinc-700 whitespace-pre-wrap">
                      {j.description ?? "—"}
                    </div>

                    {(hasBefore || hasAfter) ? (
                      <div className="flex flex-col gap-3">
                        {hasBefore ? (
                          <div>
                            <div className="text-xs font-semibold text-[#2d6a4f] mb-2">Before</div>
                            <div className="grid grid-cols-2 gap-2">
                              {j.photos.filter((p) => p.type === "before").map((p) => (
                                <img key={p.id} src={p.cloudinary_url} alt="Before photo" className="w-full h-24 object-cover rounded-2xl border border-zinc-200" />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {hasAfter ? (
                          <div>
                            <div className="text-xs font-semibold text-[#2d6a4f] mb-2">After</div>
                            <div className="grid grid-cols-2 gap-2">
                              {j.photos.filter((p) => p.type === "after").map((p) => (
                                <img key={p.id} src={p.cloudinary_url} alt="After photo" className="w-full h-24 object-cover rounded-2xl border border-zinc-200" />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-600">No photos for this job.</div>
                    )}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

