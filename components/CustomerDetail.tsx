"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, ClipboardList, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { formatDateDDMMYYYY, formatMoneyGBP, toWhatsAppInternational } from "@/lib/format";
import type { JobStatus } from "@/lib/status";
import { useOptimisticJobs } from "@/components/OptimisticJobsProvider";
import { useOptimisticCustomers } from "@/components/OptimisticCustomersProvider";

type Customer = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
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
  jobHistory: jobHistoryProp,
}: {
  customer: Customer;
  latestJob: JobWithPhotos | null;
  nextFollowUpDate: string | null;
  followUps: FollowUp[];
  recurringReminders: RecurringReminder[];
  jobHistory: JobWithPhotos[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const optimisticJobs = useOptimisticJobs();
  const optimisticCustomers = useOptimisticCustomers();

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

  const TAG_OPTIONS = ["Regular", "One-off", "Needs chasing", "VIP", "Seasonal"] as const;
  const tagSet = new Set<string>(TAG_OPTIONS as unknown as string[]);
  const [selectedTags, setSelectedTags] = useState<string[]>(customer.tags ?? []);
  const [customTagInput, setCustomTagInput] = useState("");

  useEffect(() => {
    setSelectedTags(customer.tags ?? []);
  }, [customer.tags]);

  const [jobHistoryState, setJobHistoryState] = useState(jobHistoryProp);
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null);
  const [jobExitingIds, setJobExitingIds] = useState<Set<number>>(() => new Set());
  const [followUpsState, setFollowUpsState] = useState(followUps);
  const [followUpExitingIds, setFollowUpExitingIds] = useState<Set<number>>(() => new Set());
  const [recurringState, setRecurringState] = useState(recurringReminders);
  const [recurringExitingIds, setRecurringExitingIds] = useState<Set<number>>(() => new Set());
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [openJobSwipeId, setOpenJobSwipeId] = useState<number | null>(null);
  const [draggingJobId, setDraggingJobId] = useState<number | null>(null);
  const [dragJobX, setDragJobX] = useState(0);
  const touchSwipeState = useMemo(
    () => ({ id: null as number | null, startX: 0, baseX: 0, moved: false }),
    []
  );

  useEffect(() => {
    setRecurringState(recurringReminders);
  }, [recurringReminders]);

  useEffect(() => {
    setJobHistoryState(jobHistoryProp);
  }, [jobHistoryProp]);

  useEffect(() => {
    function detectMobile() {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const mobileByUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      setIsMobileViewport(window.innerWidth < 768 || mobileByUa);
    }
    detectMobile();
    window.addEventListener("resize", detectMobile);
    return () => window.removeEventListener("resize", detectMobile);
  }, []);

  const mergedJobHistory = useMemo(() => {
    const pending = optimisticJobs?.getPendingForCustomer(customer.id) ?? [];
    const ids = new Set(jobHistoryState.map((j) => j.id));
    const extras = pending.filter((j) => !ids.has(j.id));
    return [...extras, ...jobHistoryState];
  }, [jobHistoryState, optimisticJobs, customer.id]);

  useEffect(() => {
    setFollowUpsState(followUps);
  }, [followUps]);

  const deepLinkedJobId = useMemo(() => {
    const raw = searchParams.get("job_id");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const expandedJobDetailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (deepLinkedJobId === null) return;
    setExpandedJobId(deepLinkedJobId);
  }, [deepLinkedJobId]);

  useEffect(() => {
    if (!expandedJobId) return;
    // Scroll after the <details> open state is applied.
    const t = window.setTimeout(() => {
      expandedJobDetailsRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [expandedJobId]);

  const [photoViewer, setPhotoViewer] = useState<{
    open: boolean;
    images: Photo[];
    index: number;
  }>({ open: false, images: [], index: 0 });

  useEffect(() => {
    if (!photoViewer.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePhotoViewer();
      if (e.key === "ArrowLeft") stepPhoto(-1);
      if (e.key === "ArrowRight") stepPhoto(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photoViewer.open]);

  function tagChipClasses(tag: string, variant: "selected" | "default") {
    const selected = variant === "selected";
    switch (tag) {
      case "Regular":
        return selected
          ? "bg-[var(--color-primary)] text-[var(--color-white)] border-[var(--color-border)]"
          : "bg-[var(--color-primary-surface)] text-[var(--color-text)] border-[var(--color-border)]";
      case "One-off":
        return selected
          ? "bg-[var(--color-amber-bg)] text-[var(--color-amber)] border-[var(--color-border)]"
          : "bg-[var(--color-amber-bg)]/50 text-[var(--color-text)] border-[var(--color-border)]";
      case "Needs chasing":
        return selected
          ? "bg-[var(--color-red-bg)] text-[var(--color-red)] border-[var(--color-border)]"
          : "bg-[var(--color-red-bg)]/40 text-[var(--color-text)] border-[var(--color-border)]";
      case "VIP":
        return selected
          ? "bg-[var(--color-accent)] text-[var(--color-white)] border-[var(--color-border)]"
          : "bg-[var(--color-accent-pale)] text-[var(--color-accent)] border-[var(--color-border)]";
      case "Seasonal":
        return selected
          ? "bg-[var(--color-accent)] text-[var(--color-white)] border-[var(--color-border)]"
          : "bg-[var(--color-accent-pale)] text-[var(--color-accent)] border-[var(--color-border)]";
      default:
        return selected
          ? "bg-[var(--color-text)] text-[var(--color-white)] border-[var(--color-border)]"
          : "bg-[var(--color-primary-surface)] text-[var(--color-text)] border-[var(--color-border)]";
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const has = prev.includes(tag);
      return has ? prev.filter((t) => t !== tag) : [...prev, tag];
    });
  }

  function addCustomTag() {
    const t = customTagInput.trim();
    if (!t) return;
    setSelectedTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setCustomTagInput("");
  }

  function openPhotoViewer(jobPhotos: Photo[], startPhotoId: number) {
    const images = [...jobPhotos].sort((a, b) => (a.type === b.type ? 0 : a.type === "before" ? -1 : 1));
    const index = images.findIndex((x) => x.id === startPhotoId);
    setPhotoViewer({ open: true, images, index: index >= 0 ? index : 0 });
  }

  function closePhotoViewer() {
    setPhotoViewer({ open: false, images: [], index: 0 });
  }

  function stepPhoto(delta: number) {
    setPhotoViewer((prev) => {
      if (!prev.open) return prev;
      const next = Math.min(Math.max(prev.index + delta, 0), prev.images.length - 1);
      return { ...prev, index: next };
    });
  }

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
    const snapshot = { ...contact, notes, tags: [...selectedTags] };
    setEditingContact(false);
    void (async () => {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contact.name,
          address: contact.address,
          phone: contact.phone,
          email: contact.email,
          notes: notes,
          tags: selectedTags,
        }),
      });
      if (!res.ok) {
        setContact({ name: snapshot.name, address: snapshot.address, phone: snapshot.phone, email: snapshot.email });
        setNotes(snapshot.notes);
        setSelectedTags(snapshot.tags);
        setEditingContact(true);
        return;
      }
      router.refresh();
    })();
  }

  async function saveNotes() {
    const prevNotes = notes;
    setEditingNotes(false);
    void (async () => {
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
      if (!res.ok) {
        setNotes(prevNotes);
        setEditingNotes(true);
        return;
      }
      router.refresh();
    })();
  }

  async function upsertFollowUp(e: React.FormEvent) {
    e.preventDefault();

    if (editingFollowUpId !== null) {
      const id = editingFollowUpId;
      const snapshot = followUpsState.find((x) => x.id === id);
      setFollowUpsState((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, follow_up_date: followUpDate, notes: followUpNotes, completed: editingFollowUpCompleted }
            : f
        )
      );
      setEditingFollowUpId(null);
      setFollowUpNotes("");
      void (async () => {
        const res = await fetch(`/api/follow-ups/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            followUpDate,
            notes: followUpNotes,
            completed: editingFollowUpCompleted,
          }),
        });
        if (!res.ok) {
          if (snapshot) {
            setFollowUpsState((prev) => prev.map((f) => (f.id === id ? snapshot : f)));
          }
          setEditingFollowUpId(id);
          return;
        }
        router.refresh();
      })();
      return;
    }

    const tempId = -Math.abs(Date.now());
    const notesPayload = followUpNotes;
    setFollowUpsState((prev) => [
      ...prev,
      {
        id: tempId,
        follow_up_date: followUpDate,
        notes: notesPayload || null,
        completed: false,
      },
    ]);
    setFollowUpNotes("");
    void (async () => {
      const res = await fetch("/api/follow-ups/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          followUpDate,
          notes: notesPayload,
        }),
      });
      if (!res.ok) {
        setFollowUpsState((prev) => prev.filter((f) => f.id !== tempId));
        return;
      }
      router.refresh();
    })();
  }

  async function deleteCustomer() {
    if (deleting) return;
    const ok = window.confirm(
      `Delete ${customer.name}? This will also delete their jobs, photos, and follow-ups.`
    );
    if (!ok) return;

    optimisticCustomers?.hideCustomerOptimistic(customer.id);
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      if (res.ok) {
        router.replace("/customers");
        return;
      }

      optimisticCustomers?.unhideCustomer(customer.id);
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

  function markFollowUpDone(followUpId: number) {
    const snapshot = followUpsState.find((f) => f.id === followUpId);
    setFollowUpExitingIds((prev) => new Set(prev).add(followUpId));
    const t = window.setTimeout(() => {
      setFollowUpsState((prev) =>
        prev.map((f) => (f.id === followUpId ? { ...f, completed: true } : f))
      );
      setFollowUpExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(followUpId);
        return next;
      });
    }, 200);
    void (async () => {
      try {
        const res = await fetch(`/api/follow-ups/${followUpId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!res.ok) {
          window.clearTimeout(t);
          setFollowUpExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(followUpId);
            return next;
          });
          if (snapshot) setFollowUpsState((prev) => prev.map((f) => (f.id === followUpId ? snapshot : f)));
          return;
        }
        router.refresh();
      } catch {
        window.clearTimeout(t);
        setFollowUpExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(followUpId);
          return next;
        });
        if (snapshot) setFollowUpsState((prev) => prev.map((f) => (f.id === followUpId ? snapshot : f)));
      }
    })();
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

    const snapshot = followUpsState.find((f) => f.id === followUpId);
    setFollowUpExitingIds((prev) => new Set(prev).add(followUpId));
    const t = window.setTimeout(() => {
      setFollowUpsState((prev) => prev.filter((f) => f.id !== followUpId));
      if (editingFollowUpId === followUpId) setEditingFollowUpId(null);
      setFollowUpExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(followUpId);
        return next;
      });
    }, 200);
    setDeletingFollowUpId(followUpId);
    try {
      const res = await fetch(`/api/follow-ups/${followUpId}`, { method: "DELETE" });
      if (!res.ok) {
        window.clearTimeout(t);
        setFollowUpExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(followUpId);
          return next;
        });
        if (snapshot) {
          setFollowUpsState((prev) => {
            if (prev.some((f) => f.id === followUpId)) return prev;
            return [...prev, snapshot];
          });
        }
        return;
      }
      router.refresh();
    } catch {
      window.clearTimeout(t);
      setFollowUpExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(followUpId);
        return next;
      });
      if (snapshot) {
        setFollowUpsState((prev) => {
          if (prev.some((f) => f.id === followUpId)) return prev;
          return [...prev, snapshot];
        });
      }
    } finally {
      setDeletingFollowUpId(null);
    }
  }

  function openAddJobSheet() {
    const url = new URL(window.location.href);
    url.searchParams.set("add_job", "1");
    url.searchParams.set("customerId", String(customer.id));
    url.searchParams.delete("edit_job_id");
    url.searchParams.delete("quote");
    router.push(url.pathname + url.search);
  }

  function openEditJobSheet(jobId: number) {
    const url = new URL(window.location.href);
    url.searchParams.set("add_job", "1");
    url.searchParams.set("customerId", String(customer.id));
    url.searchParams.set("edit_job_id", String(jobId));
    url.searchParams.delete("quote");
    router.push(url.pathname + url.search);
  }

  function markJobAsPaid(jobId: number) {
    if (jobId < 0) return;
    const snapshot = mergedJobHistory.find((j) => j.id === jobId);
    setJobHistoryState((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              paid: true,
              status: j.status === "quoted" || j.status === "booked" ? "completed" : j.status,
            }
          : j
      )
    );
    void (async () => {
      const res = await fetch(`/api/jobs/${jobId}/paid`, { method: "PATCH" });
      if (!res.ok && snapshot) {
        setJobHistoryState((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, paid: snapshot.paid, status: snapshot.status } : j
          )
        );
      } else if (res.ok) {
        router.refresh();
      }
    })();
  }

  function buildJobShareUrl(job: JobWithPhotos) {
    if (!customer.phone) return "";
    const whatsappNumber = toWhatsAppInternational(customer.phone);
    if (!whatsappNumber) return "";
    const firstName = customer.name.trim().split(/\s+/)[0] ?? customer.name;
    const amount = formatMoneyGBP(job.quote_amount).replace("£", "");
    const doneDate = formatDateDDMMYYYY(job.date_done);
    const msg = `Hi ${firstName}, just to confirm I completed your ${job.job_type} on ${doneDate}. Quote: £${amount}. Thanks, Tom 👍`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }

  async function deleteJob(jobId: number) {
    if (deletingJobId) return;
    if (jobId < 0) {
      optimisticJobs?.removePending(customer.id, jobId);
      setJobHistoryState((prev) => prev.filter((j) => j.id !== jobId));
      return;
    }
    const ok = window.confirm("Delete this job? Photos will also be deleted.");
    if (!ok) return;
    const snapshot = mergedJobHistory.find((j) => j.id === jobId);
    setJobExitingIds((prev) => new Set(prev).add(jobId));
    const t = window.setTimeout(() => {
      setJobHistoryState((prev) => prev.filter((j) => j.id !== jobId));
      setJobExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }, 200);
    setDeletingJobId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) {
        window.clearTimeout(t);
        setJobExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        if (snapshot) {
          setJobHistoryState((prev) => {
            if (prev.some((j) => j.id === jobId)) return prev;
            return [...prev, snapshot];
          });
        }
        return;
      }
      router.refresh();
    } catch {
      window.clearTimeout(t);
      setJobExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      if (snapshot) {
        setJobHistoryState((prev) => {
          if (prev.some((j) => j.id === jobId)) return prev;
          return [...prev, snapshot];
        });
      }
    } finally {
      setDeletingJobId(null);
    }
  }

  function markRecurringDoneRow(r: RecurringReminder) {
    const id = r.id;
    const snapshot = { ...r };
    setRecurringExitingIds((prev) => new Set(prev).add(id));
    const t = window.setTimeout(() => {
      setRecurringState((prev) => prev.filter((x) => x.id !== id));
      setRecurringExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
    void (async () => {
      try {
        const res = await fetch(`/api/recurring-reminders/${id}/done`, { method: "POST" });
        if (!res.ok) {
          window.clearTimeout(t);
          setRecurringExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setRecurringState((prev) => {
            if (prev.some((x) => x.id === id)) return prev;
            return [...prev, snapshot].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
          });
          return;
        }
        router.refresh();
      } catch {
        window.clearTimeout(t);
        setRecurringExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setRecurringState((prev) => {
          if (prev.some((x) => x.id === id)) return prev;
          return [...prev, snapshot].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
        });
      }
    })();
  }

  const upcoming = followUpsState.filter((f) => !f.completed).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
  const past = followUpsState.filter((f) => f.completed).sort((a, b) => b.follow_up_date.localeCompare(a.follow_up_date));

  const inputClass =
    "mt-1 w-full rounded-[10px] border-[1.5px] border-[var(--color-border)] px-[14px] py-[11px] bg-[var(--color-surface)] text-[var(--color-text)] input-premium text-[15px]";
  const cardShell =
    "rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4";

  const waBtn =
    "inline-flex items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-[15px] font-semibold bg-[#25D366] text-white btn-primary-interactive";
  const outlineContactBtn =
    "inline-flex items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] px-4 py-2.5 text-[14px] font-medium btn-primary-interactive";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader className="!mb-0">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-[var(--color-text)] leading-tight truncate">{customer.name}</h1>
          <div className="text-[14px] whitespace-pre-wrap">
            {customer.address?.trim() ? (
              customer.address
            ) : (
              <span className="text-[var(--color-text-subtle)] italic">Not set</span>
            )}
          </div>
          {customer.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {customer.tags.map((t) => (
                <span
                  key={t}
                  className={["inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border", tagChipClasses(t, "default")].join(" ")}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {whatsapp ? (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className={waBtn}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-4.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5z" />
                  <path d="M7.5 8.5c1 3 2.5 4.5 5.5 5.5" />
                </svg>
                WhatsApp
              </a>
            ) : null}
            {customer.phone ? (
              <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className={outlineContactBtn}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Call
              </a>
            ) : null}
            <button type="button" onClick={() => setEditingContact(true)} className={outlineContactBtn}>
              Edit
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6">
        <div className={cardShell}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">Contact details</div>
            <button
              type="button"
              onClick={() => setEditingContact((v) => !v)}
              className="px-3 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)]"
            >
              {editingContact ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div>
              <div className="text-xs font-medium text-[var(--color-text-muted)]">Name</div>
              {editingContact ? (
                <input value={contact.name} onChange={(e) => setContact((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
              ) : (
                <div className="text-sm text-[var(--color-text)] font-semibold mt-1">
                  {customer.name?.trim() ? customer.name : <span className="text-[var(--color-text-subtle)] italic font-normal">Not set</span>}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-[var(--color-text-muted)]">Address</div>
              {editingContact ? (
                <AddressAutocomplete
                  value={contact.address}
                  onChange={(value) => setContact((p) => ({ ...p, address: value }))}
                  onAddressSelect={(address) => setContact((p) => ({ ...p, address }))}
                  className={inputClass}
                  placeholder="Start typing an address..."
                />
              ) : (
                <div className="text-sm text-[var(--color-text)] mt-1">
                  {customer.address?.trim() ? customer.address : <span className="text-[var(--color-text-subtle)] italic">Not set</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <div className="text-xs font-medium text-[var(--color-text-muted)]">Phone</div>
                {editingContact ? (
                  <input value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} inputMode="tel" className={inputClass} />
                ) : (
                  <div className="text-sm text-[var(--color-text)] mt-1">
                    {customer.phone?.trim() ? customer.phone : <span className="text-[var(--color-text-subtle)] italic">Not set</span>}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-[var(--color-text-muted)]">Email</div>
                {editingContact ? (
                  <input value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} inputMode="email" className={inputClass} />
                ) : (
                  <div className="text-sm text-[var(--color-text)] mt-1">
                    {customer.email?.trim() ? customer.email : <span className="text-[var(--color-text-subtle)] italic">Not set</span>}
                  </div>
                )}
              </div>
            </div>

            {editingContact ? (
              <div>
                <div className="text-xs font-medium text-[var(--color-text-muted)]">Tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((t) => {
                    const selected = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={[
                          "px-2 py-1 rounded-full text-xs font-semibold border active:scale-[0.98]",
                          tagChipClasses(t, selected ? "selected" : "default"),
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
                      className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0"
                      placeholder="Type and press Enter"
                    />
                  </label>

                  {customTagInput.trim() ? (
                    <button
                      type="button"
                      onClick={addCustomTag}
                      className="mt-2 px-3 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-semibold active:scale-[0.98]"
                    >
                      Add tag
                    </button>
                  ) : null}
                </div>

                {selectedTags.filter((t) => !tagSet.has(t)).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTags
                      .filter((t) => !tagSet.has(t))
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTag(t)}
                          className={[
                            "px-2 py-1 rounded-full text-xs font-semibold border bg-white active:scale-[0.98]",
                            "text-zinc-800 border-[var(--color-border)]",
                          ].join(" ")}
                        >
                          {t} <span className="ml-1 text-zinc-400">×</span>
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {editingContact ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={saveContact}
                className="w-full rounded-2xl bg-[var(--color-primary)] text-white py-3 text-base font-semibold active:scale-[0.99]"
              >
                Save contact
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">Notes / preferences</div>
            <button
              type="button"
              onClick={() => setEditingNotes((v) => !v)}
              className="px-3 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold"
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
                  className="w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={saveNotes}
                  className="w-full mt-3 rounded-[12px] py-[13px] text-[15px] font-semibold btn-solid-accent"
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

        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Current status</div>
          <div className="mt-3 flex flex-col gap-3">
            {latestJob ? (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-border)] p-3">
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
                  <div className="font-currency text-[17px] text-[var(--color-text)]">{formatMoneyGBP(latestJob.quote_amount)}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-600">No jobs yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Follow-ups</div>
          <div className="text-xs text-zinc-600">Upcoming + past</div>
        </div>

        <form onSubmit={upsertFollowUp} className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="text-sm font-medium text-zinc-700">
              Follow-up date
              <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0" />
            </label>
            <div className="flex flex-col gap-2">
              <button type="submit" className="rounded-[12px] py-[13px] text-[15px] font-semibold btn-solid-accent">
                  {editingFollowUpId !== null ? "Update follow-up" : "Save follow-up"}
              </button>
                {editingFollowUpId !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFollowUpId(null);
                      setFollowUpNotes("");
                    }}
                    className="rounded-2xl border border-[var(--color-border)] bg-white text-sm font-semibold py-3 active:scale-[0.99]"
                  >
                    Cancel edit
                  </button>
                ) : null}
            </div>
          </div>

          <label className="text-sm font-medium text-zinc-700">
            Notes
            <textarea value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0" placeholder="What should we do next?" />
          </label>
        </form>

        <div className="mt-4 flex flex-col gap-3">
          {upcoming.length > 0 ? (
            <div>
              <div className="section-label-card mb-2">Upcoming</div>
              <div className="flex flex-col gap-2">
                {upcoming.map((f) => (
                  <div
                    key={f.id}
                    className={[
                      "rounded-2xl border border-[var(--color-border)] p-3 flex items-start justify-between gap-3 bg-[var(--color-white)]",
                      followUpExitingIds.has(f.id) ? "animate-row-exit" : "",
                    ].join(" ")}
                  >
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
                        className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-white text-zinc-800 text-sm font-semibold active:scale-[0.99]"
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
              <div className="section-label-card mb-2 mt-4">Past</div>
              <div className="flex flex-col gap-2">
                {past.map((f) => (
                    <div key={f.id} className="rounded-2xl border border-[var(--color-border)] p-3 flex items-start justify-between gap-3">
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
                          className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-white text-zinc-800 text-sm font-semibold active:scale-[0.99]"
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
            <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-[18px] py-12 text-center">
              <div className="flex justify-center mb-4 text-[var(--color-text-muted)]" aria-hidden>
                <ClipboardList className="w-12 h-12 stroke-[1.5]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--color-text)]">No follow-ups set</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">Add a date and save to schedule the next check-in.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Recurring reminders</div>
          <div className="text-xs text-zinc-600">Tap “Done” to roll forward</div>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {recurringState.length === 0 ? (
            <div className="text-sm text-zinc-600">No recurring reminders yet.</div>
          ) : (
            recurringState.map((r) => (
              <div
                key={r.id}
                className={[
                  "rounded-2xl border border-[var(--color-border)] p-3 flex items-start justify-between gap-3 bg-[var(--color-white)]",
                  recurringExitingIds.has(r.id) ? "animate-row-exit" : "",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-text)]">{r.job_type}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Every {r.interval_days} days
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Next due: {formatDateDDMMYYYY(r.next_due_date)}
                  </div>
                </div>
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => markRecurringDoneRow(r)}
                    className="px-3 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-white)] text-sm font-semibold btn-primary-interactive"
                  >
                    Done
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={addRecurringReminder} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium text-zinc-700">
              Reminder name / job type
              <input value={recurringJobType} onChange={(e) => setRecurringJobType(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0" />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Interval (days)
              <input value={recurringIntervalDays} onChange={(e) => setRecurringIntervalDays(e.target.value)} inputMode="numeric" className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0" />
            </label>
          </div>

          <button type="submit" className="rounded-[12px] py-[13px] text-[15px] font-semibold btn-solid-accent">
            Add recurring reminder
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">Job history</div>
          <button
            type="button"
            onClick={openAddJobSheet}
            className="rounded-2xl bg-[var(--color-primary)] text-white px-4 py-3 text-sm font-semibold active:scale-[0.99]"
          >
            Add Job
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {mergedJobHistory.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-[18px] py-12 text-center">
              <div className="flex justify-center mb-4 text-[var(--color-text-muted)]" aria-hidden>
                <Briefcase className="w-12 h-12 stroke-[1.5]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--color-text)]">No jobs logged yet</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2 mb-4">Add a job to track work and photos.</p>
              <button
                type="button"
                onClick={openAddJobSheet}
                className="rounded-2xl bg-[var(--color-primary)] text-[var(--color-white)] px-5 py-3 text-sm font-semibold btn-primary-interactive"
              >
                Add Job
              </button>
            </div>
          ) : (
            mergedJobHistory.map((j) => {
              const hasBefore = j.photos.some((p) => p.type === "before");
              const hasAfter = j.photos.some((p) => p.type === "after");
              const SWIPE_WIDTH = 92;
              const shareUrl = j.status === "completed" ? buildJobShareUrl(j) : "";
              const translateX =
                draggingJobId === j.id ? dragJobX : openJobSwipeId === j.id ? -SWIPE_WIDTH : 0;
              return (
                <div key={j.id} className="relative overflow-hidden rounded-2xl">
                  <button
                    type="button"
                    onClick={() => deleteJob(j.id)}
                    className="absolute right-0 top-0 bottom-0 w-[92px] bg-[#ef4444] text-white text-[13px] font-semibold"
                    style={{ borderRadius: "0 14px 14px 0" }}
                    aria-label="Delete job"
                  >
                    Delete
                  </button>
                  <details
                    className={[
                      "rounded-2xl border border-[var(--color-border)] p-3 bg-[var(--color-white)] relative",
                      jobExitingIds.has(j.id) ? "animate-row-exit" : "",
                    ].join(" ")}
                    open={expandedJobId === j.id}
                    onToggle={(e) => {
                      const el = e.currentTarget;
                      if (!el.open && expandedJobId === j.id) setExpandedJobId(null);
                      if (el.open) setExpandedJobId(j.id);
                    }}
                    onTouchStart={(e) => {
                      if (!isMobileViewport) return;
                      touchSwipeState.id = j.id;
                      touchSwipeState.startX = e.touches[0].clientX;
                      touchSwipeState.baseX = openJobSwipeId === j.id ? -SWIPE_WIDTH : 0;
                      touchSwipeState.moved = false;
                      if (openJobSwipeId && openJobSwipeId !== j.id) setOpenJobSwipeId(null);
                      setDraggingJobId(j.id);
                    }}
                    onTouchMove={(e) => {
                      if (!isMobileViewport || touchSwipeState.id !== j.id) return;
                      const dx = e.touches[0].clientX - touchSwipeState.startX;
                      const nextX = Math.min(0, Math.max(-SWIPE_WIDTH, touchSwipeState.baseX + dx));
                      if (Math.abs(dx) > 8) touchSwipeState.moved = true;
                      setDragJobX(nextX);
                    }}
                    onTouchEnd={(e) => {
                      if (!isMobileViewport || touchSwipeState.id !== j.id) return;
                      if (touchSwipeState.moved) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                      const shouldOpen = dragJobX <= -SWIPE_WIDTH / 2;
                      setOpenJobSwipeId(shouldOpen ? j.id : null);
                      setDraggingJobId(null);
                      setDragJobX(0);
                      touchSwipeState.id = null;
                    }}
                    style={{
                      transform: `translateX(${translateX}px)`,
                      transition: draggingJobId === j.id ? "none" : "transform 180ms ease",
                    }}
                    ref={(el) => {
                      if (el && expandedJobId === j.id) expandedJobDetailsRef.current = el;
                    }}
                  >
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
                        <div className="font-currency text-[17px] text-[var(--color-text)]">
                          {formatMoneyGBP(j.quote_amount)}
                        </div>

                        {j.paid ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-[var(--color-primary-pale)] text-[var(--color-primary)] border border-[var(--color-border)] text-xs font-semibold animate-badge-pop">
                            Paid ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markJobAsPaid(j.id);
                            }}
                            className="px-3 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-white)] text-xs font-semibold btn-primary-interactive"
                          >
                            Mark as paid
                          </button>
                        )}

                        <div className="flex items-center gap-2">
                          {shareUrl ? (
                            <a
                              href={shareUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(shareUrl, "_blank", "noopener,noreferrer");
                              }}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#25D366] bg-white text-[#25D366] text-xs font-semibold active:scale-[0.99]"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Share
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditJobSheet(j.id);
                            }}
                            className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-white text-zinc-800 text-xs font-semibold active:scale-[0.99]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteJob(j.id);
                            }}
                            className="px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-red-bg)] text-[var(--color-red)] text-xs font-semibold btn-destructive-press"
                          >
                            Delete
                          </button>
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
                            <div className="section-label-card mb-2">Before</div>
                            <div className="grid grid-cols-2 gap-2">
                              {j.photos.filter((p) => p.type === "before").map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => openPhotoViewer(j.photos, p.id)}
                                  className="block w-full h-24 rounded-2xl border border-[var(--color-border)] overflow-hidden active:scale-[0.99]"
                                  aria-label="Open before photo"
                                >
                                  <img src={p.cloudinary_url} alt="Before photo" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {hasAfter ? (
                          <div>
                            <div className="section-label-card mb-2">After</div>
                            <div className="grid grid-cols-2 gap-2">
                              {j.photos.filter((p) => p.type === "after").map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => openPhotoViewer(j.photos, p.id)}
                                  className="block w-full h-24 rounded-2xl border border-[var(--color-border)] overflow-hidden active:scale-[0.99]"
                                  aria-label="Open after photo"
                                >
                                  <img src={p.cloudinary_url} alt="After photo" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-primary-surface)]/40 px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                        <div className="mx-auto w-10 h-10 rounded-xl bg-[var(--color-primary-pale)]/80 flex items-center justify-center mb-2 text-[var(--color-primary)]">
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                        No photos for this job
                      </div>
                    )}
                  </div>
                  </details>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 mt-6 pt-2 mb-6">
        <button
          type="button"
          onClick={deleteCustomer}
          disabled={deleting}
          className="inline-flex shrink-0 border-[1.5px] border-[#ef4444] bg-transparent text-[#ef4444] rounded-[10px] px-6 py-[10px] text-sm font-medium disabled:opacity-60 active:scale-[0.99]"
        >
          {deleting ? "Deleting..." : "Delete customer"}
        </button>
        {deleteError ? (
          <div className="mt-1 w-full max-w-md rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm text-center">
            {deleteError}
          </div>
        ) : null}
      </div>

      {photoViewer.open ? (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          onClick={closePhotoViewer}
        >
          <div
            className="relative w-full max-w-full md:max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePhotoViewer}
              className="absolute top-3 right-3 rounded-full bg-white/95 border border-[var(--color-border)] w-10 h-10 flex items-center justify-center shadow-md"
              aria-label="Close photo viewer"
            >
              <span className="text-zinc-800 text-xl leading-none">×</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => stepPhoto(-1)}
                disabled={photoViewer.index <= 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white/95 border border-[var(--color-border)] w-10 h-10 flex items-center justify-center shadow-md disabled:opacity-40"
                aria-label="Previous photo"
              >
                <span className="text-zinc-800 text-2xl leading-none">‹</span>
              </button>
              <button
                type="button"
                onClick={() => stepPhoto(1)}
                disabled={photoViewer.index >= photoViewer.images.length - 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-white/95 border border-[var(--color-border)] w-10 h-10 flex items-center justify-center shadow-md disabled:opacity-40"
                aria-label="Next photo"
              >
                <span className="text-zinc-800 text-2xl leading-none">›</span>
              </button>

              <div
                className="w-full"
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  const el = e.currentTarget as HTMLDivElement;
                  el.dataset.startX = String(t.clientX);
                  el.dataset.startY = String(t.clientY);
                }}
                onTouchEnd={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  const startX = Number(el.dataset.startX ?? 0);
                  const startY = Number(el.dataset.startY ?? 0);
                  const t = e.changedTouches[0];
                  const dx = t.clientX - startX;
                  const dy = t.clientY - startY;
                  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
                    if (dx < 0) stepPhoto(1);
                    else stepPhoto(-1);
                  }
                }}
              >
                <img
                  src={photoViewer.images[photoViewer.index]?.cloudinary_url}
                  alt="Job photo"
                  className="w-full max-h-[78vh] object-contain rounded-2xl border border-zinc-700 bg-zinc-900"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

