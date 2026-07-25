"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { uploadImageToCloudinaryUnsigned } from "@/lib/cloudinaryUpload";
import { useOptimisticJobs } from "@/components/OptimisticJobsProvider";
import { useJobPhotoPrompt } from "@/components/JobPhotoPromptProvider";

type DropdownCustomer = { id: number; name: string; distance_miles?: string | number | null };
type PhotoDraft = { id: string; file: File; previewUrl: string; tag: "before" | "after"; shareToGallery: boolean };

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

const STATUS_OPTIONS = [
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "needs_follow_up", label: "Needs follow-up" },
] as const;

const TIME_OF_DAY_OPTIONS = [
  { value: "am", label: "AM" },
  { value: "pm", label: "PM" },
  { value: "all_day", label: "All day" },
] as const;

const RECURRING_INTERVAL_OPTIONS = [
  { value: 1, label: "1 week" },
  { value: 2, label: "2 weeks" },
  { value: 4, label: "4 weeks" },
  { value: 6, label: "6 weeks" },
] as const;

type JobTemplate = {
  id: number;
  name: string;
  job_type: string;
  description: string | null;
  default_amount: string | number | null;
  time_of_day: "am" | "pm" | "all_day";
};

function isAllowedTimeOfDay(value: string): value is "am" | "pm" | "all_day" {
  return value === "am" || value === "pm" || value === "all_day";
}

function toInputDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function syncStatusAndPaid(
  nextStatus: (typeof STATUS_OPTIONS)[number]["value"],
  nextPaid: boolean
): { status: (typeof STATUS_OPTIONS)[number]["value"]; paid: boolean } {
  if (nextStatus === "completed") {
    return { status: "completed", paid: true };
  }
  if (nextPaid) {
    return { status: "completed", paid: true };
  }
  return { status: nextStatus, paid: false };
}

function StatusSelect({
  value,
  onChange,
}: {
  value: (typeof STATUS_OPTIONS)[number]["value"];
  onChange: (v: (typeof STATUS_OPTIONS)[number]["value"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function syncPosition() {
      const el = buttonRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("resize", syncPosition);
    return () => {
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("resize", syncPosition);
    };
  }, [open]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const current = STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];

  const listbox =
    open && menuRect && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            role="listbox"
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              zIndex: 9999,
            }}
            className="max-h-48 overflow-y-auto rounded-[10px] border-[1.5px] border-[var(--c-border)] bg-[var(--c-surface)] py-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <li key={s.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === s.value}
                  className={[
                    "w-full px-3 py-2.5 text-left text-[15px] font-sans",
                    value === s.value
                      ? "bg-[#fafafa] font-semibold text-[var(--c-info)]"
                      : "text-[var(--c-text)] hover:bg-[#fafafa]",
                  ].join(" ")}
                  onClick={() => {
                    onChange(s.value);
                    setOpen(false);
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="sheet-field-input flex w-full items-center justify-between gap-2 text-left"
      >
        <span>{current.label}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0 text-[var(--c-text-muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {listbox}
    </div>
  );
}

export default function AddJobSheet() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const optimistic = useOptimisticJobs();
  const { promptForJobPhotos, showToast } = useJobPhotoPrompt();

  const addJobOpen = searchParams.get("add_job") === "1";
  const preselectedCustomerId = searchParams.get("customerId");
  const editJobId = searchParams.get("edit_job_id");
  const copyJobId = searchParams.get("copy_job_id");
  const editing = Boolean(editJobId);

  const [customers, setCustomers] = useState<DropdownCustomer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const defaultDate = useMemo(() => toInputDate(new Date()), []);

  const [customerId, setCustomerId] = useState<string>("");
  const [jobType, setJobType] = useState<(typeof JOB_TYPE_OPTIONS)[number]>("Lawn Mow");
  const [description, setDescription] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("quoted");
  const [quoteAmount, setQuoteAmount] = useState<string>("");
  const [mileageMiles, setMileageMiles] = useState<string>("");
  const [paid, setPaid] = useState<boolean>(false);
  const [initialStatus, setInitialStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("quoted");
  const [initialPaid, setInitialPaid] = useState<boolean>(false);
  const [dateDone, setDateDone] = useState<string>(defaultDate);
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm" | "all_day">("all_day");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringIntervalWeeks, setRecurringIntervalWeeks] = useState<number>(2);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<"environment" | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!addJobOpen) return;

    setError(null);
    setBusy(false);
    setClosing(false);
    setPhotos([]);

    setDateDone(defaultDate);
    setCustomerId(preselectedCustomerId ?? "");
    setJobType("Lawn Mow");
    setDescription("");
    setPrivateNotes("");
    setStatus("quoted");
    setQuoteAmount("");
    setMileageMiles("");
    setPaid(false);
    setInitialStatus("quoted");
    setInitialPaid(false);
    setTimeOfDay("all_day");
    setIsRecurring(false);
    setRecurringIntervalWeeks(2);
    setTemplatePickerOpen(false);

    async function hydrateEditJob() {
      if (!editJobId && !copyJobId) return;
      try {
        const sourceId = editJobId ?? copyJobId;
        const res = await fetch(`/api/jobs/${sourceId}`);
        if (!res.ok) return;
        const data = await res.json();
        const job = data?.job;
        if (!job) return;

        setCustomerId(String(job.customerId ?? preselectedCustomerId ?? ""));
        setJobType(job.jobType ?? "Lawn Mow");
        setDescription(job.description ?? "");
        setPrivateNotes(job.privateNotes ?? "");
        setStatus(editJobId ? job.status ?? "quoted" : "quoted");
        setQuoteAmount(job.quoteAmount === null || job.quoteAmount === undefined ? "" : String(job.quoteAmount));
        setMileageMiles(
          editJobId ? (job.mileageMiles === null || job.mileageMiles === undefined ? "" : String(job.mileageMiles)) : ""
        );
        setPaid(editJobId ? Boolean(job.paid) : false);
        setInitialStatus(editJobId ? job.status ?? "quoted" : "quoted");
        setInitialPaid(editJobId ? Boolean(job.paid) : false);
        setDateDone(editJobId ? (job.dateDone ?? "") : defaultDate);
        setTimeOfDay(isAllowedTimeOfDay(String(job.timeOfDay ?? "")) ? job.timeOfDay : "all_day");
        setIsRecurring(Boolean(job.isRecurring));
        const interval = Number(job.recurringIntervalWeeks ?? 2);
        setRecurringIntervalWeeks(Number.isFinite(interval) && interval > 0 ? interval : 2);
      } catch {
        // ignore
      }
    }

    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?forDropdown=1");
        if (!res.ok) return;
        const data = await res.json();
        setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      } catch {
        // ignore
      }
    }

    async function loadTemplates() {
      if (editing) return;
      try {
        const res = await fetch("/api/job-templates");
        if (!res.ok) return;
        const data = await res.json();
        const rows = Array.isArray(data?.templates) ? data.templates : [];
        setTemplates(
          rows.map((t: Record<string, unknown>) => ({
            id: Number(t.id),
            name: String(t.name ?? ""),
            job_type: String(t.job_type ?? ""),
            description: t.description == null ? null : String(t.description),
            default_amount: t.default_amount as string | number | null,
            time_of_day: isAllowedTimeOfDay(String(t.time_of_day ?? ""))
              ? (String(t.time_of_day) as "am" | "pm" | "all_day")
              : "all_day",
          }))
        );
      } catch {
        // ignore
      }
    }

    loadCustomers();
    loadTemplates();
    hydrateEditJob();
  }, [addJobOpen, preselectedCustomerId, editJobId, copyJobId, defaultDate, editing]);

  useEffect(() => {
    if (editing) return;
    const selected = customers.find((c) => String(c.id) === customerId);
    const oneWay = Number(selected?.distance_miles ?? NaN);
    if (!Number.isFinite(oneWay)) return;
    setMileageMiles(String(Math.round(oneWay * 2 * 10) / 10));
  }, [customerId, customers, editing]);

  function closeSheet() {
    setClosing(true);
    window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("add_job");
      params.delete("customerId");
      params.delete("edit_job_id");
      params.delete("copy_job_id");
      router.replace(`${pathname}?${params.toString()}`);
      setClosing(false);
    }, 200);
  }

  const fieldsValid = useMemo(() => {
    return Boolean(customerId && jobType && dateDone);
  }, [customerId, jobType, dateDone]);

  const canSave = useMemo(() => fieldsValid && !busy, [fieldsValid, busy]);

  function setStatusAndPaid(nextStatus: (typeof STATUS_OPTIONS)[number]["value"], nextPaid: boolean) {
    const synced = syncStatusAndPaid(nextStatus, nextPaid);
    setStatus(synced.status);
    setPaid(synced.paid);
  }

  function onStatusChange(nextStatus: (typeof STATUS_OPTIONS)[number]["value"]) {
    if (nextStatus === "completed") {
      setStatusAndPaid("completed", true);
      return;
    }
    if (paid) {
      setStatusAndPaid(nextStatus, false);
      return;
    }
    setStatus(nextStatus);
  }

  function onPaidToggle() {
    const nextPaid = !paid;
    if (nextPaid) {
      setStatusAndPaid("completed", true);
      return;
    }
    if (status === "completed") {
      setStatusAndPaid("booked", false);
      return;
    }
    setPaid(false);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setBusy(true);
    setError(null);

    const cid = Number(customerId);
    const tempId = -Math.abs(Date.now());

    try {
      const photoPayload: { url: string; type: "before" | "after"; tags: string[]; cloudinaryPublicId: string }[] = [];
      if (photos.length > 0) {
        if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || !process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim()) {
          setError(
            "Photo upload is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to your environment (Vercel + local .env.local), then redeploy."
          );
          return;
        }
        for (const p of photos) {
          try {
            const tags = ["patch", p.tag];
            if (p.shareToGallery) tags.push("gallery");
            const upload = await uploadImageToCloudinaryUnsigned(p.file, { tags });
            photoPayload.push({ url: upload.secureUrl, type: p.tag, tags, cloudinaryPublicId: upload.publicId });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Photo upload failed");
            return;
          }
        }
      }

      const synced = syncStatusAndPaid(status, paid);
      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("jobType", jobType);
      formData.set("description", description);
      formData.set("privateNotes", privateNotes);
      formData.set("status", synced.status);
      formData.set("quoteAmount", quoteAmount);
      formData.set("mileageMiles", mileageMiles);
      formData.set("paid", synced.paid ? "true" : "false");
      formData.set("dateDone", dateDone);
      formData.set("timeOfDay", timeOfDay);
      formData.set("isRecurring", isRecurring ? "true" : "false");
      formData.set("recurringIntervalWeeks", isRecurring ? String(recurringIntervalWeeks) : "");

      if (photoPayload.length > 0) {
        formData.set("photoPayload", JSON.stringify(photoPayload));
      }

      if (!editing && Number.isFinite(cid) && optimistic) {
        optimistic.addPending(cid, {
          id: tempId,
          job_type: jobType,
          description: description || null,
          private_notes: privateNotes || null,
          status: synced.status,
          quote_amount: quoteAmount.trim().length ? quoteAmount : null,
          paid: synced.paid,
          date_done: dateDone,
          mileage_miles: mileageMiles.trim().length ? mileageMiles : null,
          time_of_day: timeOfDay,
          is_recurring: isRecurring,
          recurring_interval_weeks: isRecurring ? recurringIntervalWeeks : null,
          photos: [],
        });
        closeSheet();
        router.refresh();
      }

      const res = await fetch(editing ? `/api/jobs/${editJobId}` : "/api/jobs", {
        method: editing ? "PUT" : "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = typeof data?.error === "string" ? data.error : "Could not save job";
        if (!editing && optimistic) {
          optimistic.removePending(cid, tempId);
          window.alert(msg);
        }
        setError(msg);
        return;
      }

      const data = (await res.json().catch(() => null)) as { jobId?: number | string } | null;
      const resolvedJobId =
        editing && Number.isFinite(Number(editJobId))
          ? Number(editJobId)
          : Number(data?.jobId ?? NaN);

      const becameCompleted = editing && initialStatus !== "completed" && synced.status === "completed";
      const becamePaid = editing && !initialPaid && synced.paid;
      if (becamePaid) {
        showToast("Job marked as paid ✓");
      } else if (becameCompleted) {
        showToast("Job marked as complete ✓");
      }
      if ((becameCompleted || becamePaid) && Number.isFinite(resolvedJobId)) {
        void promptForJobPhotos(resolvedJobId);
      }

      if (!editing && optimistic) {
        optimistic.removePending(cid, tempId);
      }
      if (editing) {
        closeSheet();
      }
      router.refresh();
    } catch {
      if (!editing && optimistic && Number.isFinite(cid)) {
        optimistic.removePending(cid, tempId);
        window.alert("Could not save job");
      }
      setError("Could not save job");
    } finally {
      setBusy(false);
    }
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const drafts: PhotoDraft[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      tag: "before",
      shareToGallery: false,
    }));

    setPhotos((prev) => [...prev, ...drafts]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!addJobOpen && !closing) return null;

  function openNativePicker(mode?: "environment") {
    setCaptureMode(mode);
    window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }

  function onAddPhotosTap() {
    if (isMobileViewport) {
      setPhotoPromptOpen(true);
      return;
    }
    openNativePicker();
  }

  function applyTemplate(template: JobTemplate) {
    const jobTypeMatch = JOB_TYPE_OPTIONS.find((jt) => jt === template.job_type);
    if (jobTypeMatch) setJobType(jobTypeMatch);
    else if (template.job_type) setJobType(template.job_type as (typeof JOB_TYPE_OPTIONS)[number]);
    setDescription(template.description ?? "");
    if (template.default_amount != null && String(template.default_amount).trim() !== "") {
      setQuoteAmount(String(template.default_amount));
    }
    setTimeOfDay(template.time_of_day);
    setTemplatePickerOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Edit Job" : "Add Job"}
    >
      <button
        type="button"
        onClick={closeSheet}
        className={[
          "absolute inset-0 bg-black/40",
          closing ? "sheet-backdrop-exit" : "sheet-backdrop-enter",
        ].join(" ")}
        aria-label="Close"
      />

      <div
        className={[
          "absolute left-0 right-0 bottom-0 flex max-h-[92vh] min-h-0 flex-col overflow-hidden rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-surface)] w-full max-w-full md:max-w-md mx-auto",
          closing ? "sheet-panel-exit" : "sheet-panel-enter",
        ].join(" ")}
      >
        <div className="shrink-0 border-b border-[var(--c-border)] p-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--c-text)]">{editing ? "Edit Job" : "Add Job"}</div>
            <div className="text-xs text-[var(--c-text-muted)]">Track jobs, photos, and status</div>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            className="px-3 py-2 rounded-xl border border-[var(--c-border)] text-[var(--c-text)]"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="sheet-field-stagger flex flex-col gap-4 px-4 pt-4 pb-2">
          {!editing ? (
            <div>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen((o) => !o)}
                className="w-full rounded-[10px] border-[1.5px] border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-3 text-[14px] font-semibold text-[var(--c-text)] btn-outline-interactive"
              >
                Use template
              </button>
              {templatePickerOpen ? (
                <div className="mt-2 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden">
                  {templates.length === 0 ? (
                    <div className="px-4 py-3 text-[13px] text-[var(--c-text-muted)]">
                      No templates yet. Add them in Settings.
                    </div>
                  ) : (
                    templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="w-full border-b border-[var(--c-border)] last:border-b-0 px-4 py-3 text-left hover:bg-[var(--c-bg)] active:bg-[var(--c-bg)]"
                      >
                        <div className="text-[14px] font-semibold text-[var(--c-text)]">{t.name}</div>
                        <div className="text-[12px] text-[var(--c-text-muted)] mt-0.5">{t.job_type}</div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-normal text-[var(--c-text)]">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={Boolean(preselectedCustomerId)}
              className="mt-2 sheet-field-input sheet-select-native disabled:opacity-75"
            >
              <option value="" disabled>
                Select customer
              </option>
              {customers.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            {Boolean(preselectedCustomerId) ? (
              <div className="text-xs text-[var(--c-text-muted)] mt-1">Customer preselected.</div>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-normal text-[var(--c-text)]">Job type</label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as (typeof JOB_TYPE_OPTIONS)[number])}
              className="mt-2 sheet-field-input sheet-select-native"
            >
              {JOB_TYPE_OPTIONS.map((jt) => (
                <option key={jt} value={jt}>
                  {jt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-normal text-[var(--c-text)]">Description / notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 sheet-field-input min-h-[104px] resize-y"
              placeholder="Add details about the job..."
            />
          </div>

          <div>
            <label className="text-sm font-normal text-[var(--c-text)] inline-flex items-center gap-1.5">
              <span>Private notes</span>
              <span className="text-[12px] text-[var(--c-text-subtle)]">(private)</span>
            </label>
            <textarea
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              rows={3}
              className="mt-2 sheet-field-input min-h-[90px] resize-y"
              placeholder="Gate code, parking notes, customer preferences..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-normal text-[var(--c-text)]">Status</label>
              <div className="mt-2">
                <StatusSelect value={status} onChange={onStatusChange} />
              </div>
            </div>

            <div>
              <label className="text-sm font-normal text-[var(--c-text)]">Date done</label>
              <input
                type="date"
                value={dateDone}
                onChange={(e) => setDateDone(e.target.value)}
                className="mt-2 sheet-field-input"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-normal text-[var(--c-text)]">Time of day</label>
            <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-[12px] border-[1.5px] border-[var(--c-border)] bg-[var(--c-surface)]">
              {TIME_OF_DAY_OPTIONS.map((option) => {
                const selected = timeOfDay === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeOfDay(option.value)}
                    className={[
                      "h-[44px] text-sm font-semibold transition-colors",
                      "border-r-[1.5px] border-[var(--c-border)] last:border-r-0",
                      selected
                        ? "bg-[var(--c-primary)] text-[var(--c-surface)]"
                        : "bg-[var(--c-surface)] text-[var(--c-text)]",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-normal text-[var(--c-text)]">Recurring maintenance</label>
            <div className="mt-2 flex h-[46px] items-center justify-between gap-3 rounded-[10px] border-[1.5px] border-[var(--c-border)] bg-[var(--c-bg)] px-3">
              <span className="text-[15px] text-[var(--c-text)]">Make this a recurring job</span>
              <button
                type="button"
                role="switch"
                aria-checked={isRecurring}
                onClick={() => setIsRecurring((v) => !v)}
                className={[
                  "relative h-8 w-[52px] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-border-strong)] focus-visible:ring-offset-2",
                  isRecurring ? "bg-[var(--c-primary)]" : "bg-[var(--c-border-strong)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out",
                    isRecurring ? "translate-x-6" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>
            {isRecurring ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RECURRING_INTERVAL_OPTIONS.map((option) => {
                  const selected = recurringIntervalWeeks === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRecurringIntervalWeeks(option.value)}
                      className={[
                        "h-[44px] rounded-[10px] border-[1.5px] text-sm font-semibold transition-colors",
                        selected
                          ? "border-[var(--c-primary)] bg-[var(--c-primary)] text-[var(--c-bg)]"
                          : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm font-normal text-[var(--c-text)]">Quote amount (£)</label>
              <input
                inputMode="decimal"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                placeholder="e.g. 120"
                className="mt-2 sheet-field-input"
              />
            </div>
            <div>
              <label className="text-sm font-normal text-[var(--c-text)]">Mileage (miles return)</label>
              <input
                inputMode="decimal"
                value={mileageMiles}
                onChange={(e) => setMileageMiles(e.target.value)}
                placeholder="e.g. 9.2"
                className="mt-2 sheet-field-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 items-end">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-normal text-[var(--c-text)]">Paid</span>
              <div className="flex h-[46px] items-center justify-between gap-3 rounded-[10px] border-[1.5px] border-[var(--c-border)] bg-[#fafafa] px-3">
                <span className="text-[15px] text-[var(--c-text)]">{paid ? "Yes" : "No"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={paid}
                  onClick={onPaidToggle}
                  className={[
                    "relative h-8 w-[52px] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-border-strong)] focus-visible:ring-offset-2",
                    paid ? "bg-[var(--c-primary)]" : "bg-[var(--c-border-strong)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out",
                      paid ? "translate-x-6" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="text-sm font-normal text-[var(--c-text)]">Photos</label>
                {photos.length > 0 ? (
                  <p className="mt-0.5 text-[12px] text-[var(--c-text-muted)]">
                    {photos.length} photo{photos.length === 1 ? "" : "s"} selected
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 border border-[var(--c-border-strong)] rounded-[8px] px-[12px] py-[4px] text-[13px] font-normal text-[var(--c-text)] btn-outline-interactive"
                onClick={onAddPhotosTap}
              >
                Add photos
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              capture={captureMode}
              onChange={onFilesSelected}
              className="hidden"
            />

            {photos.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {photos.map((p, index) => (
                  <div
                    key={p.id}
                    className="shrink-0 rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] p-2"
                  >
                    <div className="flex min-h-[52px] items-center gap-2">
                      <img
                        src={p.previewUrl}
                        alt={`Photo ${index + 1} preview`}
                        className="h-12 w-12 shrink-0 rounded-[8px] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-[var(--c-text)]">
                          {p.file.name?.trim() ? p.file.name : `Photo ${index + 1}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-pressed={p.tag === "before"}
                          onClick={() =>
                            setPhotos((prev) =>
                              prev.map((x) =>
                                x.id === p.id ? { ...x, tag: "before", shareToGallery: false } : x
                              )
                            )
                          }
                          className={[
                            "rounded-[8px] border px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap",
                            p.tag === "before"
                              ? "border-[var(--c-primary)] bg-[var(--c-primary)] text-white"
                              : "border-[var(--c-border)] text-[var(--c-text)]",
                          ].join(" ")}
                        >
                          Before
                        </button>
                        <button
                          type="button"
                          aria-pressed={p.tag === "after"}
                          onClick={() =>
                            setPhotos((prev) =>
                              prev.map((x) => (x.id === p.id ? { ...x, tag: "after", shareToGallery: true } : x))
                            )
                          }
                          className={[
                            "rounded-[8px] border px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap",
                            p.tag === "after"
                              ? "border-[var(--c-primary)] bg-[var(--c-primary)] text-white"
                              : "border-[var(--c-border)] text-[var(--c-text)]",
                          ].join(" ")}
                        >
                          After
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="shrink-0 rounded-[8px] border border-[var(--c-border)] px-2 py-1.5 text-[11px] font-medium text-[var(--c-text-muted)] whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 flex h-[34px] items-center justify-between rounded-[10px] border border-[var(--c-border)] px-2">
                      <span className="text-[11px] text-[var(--c-text)]">Show on website gallery</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.shareToGallery}
                        onClick={() =>
                          setPhotos((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, shareToGallery: !x.shareToGallery } : x))
                          )
                        }
                        className={[
                          "relative h-5 w-9 rounded-full transition-colors",
                          p.shareToGallery ? "bg-[var(--c-primary)]" : "bg-[var(--c-border-strong)]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                            p.shareToGallery ? "translate-x-4" : "translate-x-0",
                          ].join(" ")}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-[var(--c-text-muted)]">
                Select one or more photos, then tag each as <span className="font-semibold">before</span> or{" "}
                <span className="font-semibold">after</span>.
              </div>
            )}
          </div>

            {error ? (
              <div className="rounded-xl border border-[var(--c-border)] bg-[rgba(220,38,38,0.08)] text-[var(--c-danger)] px-4 py-3 text-sm">
                {error}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 z-10 shrink-0 border-t border-[var(--c-border)] bg-[var(--c-surface)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={!fieldsValid}
              aria-busy={busy}
              className="w-full btn-primary-solid bg-[var(--c-primary)] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving..." : editing ? "Save changes" : "Save job"}
            </button>
          </div>
        </form>
      </div>

      {photoPromptOpen ? (
        <div className="absolute inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setPhotoPromptOpen(false)}
            aria-label="Close photo options"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--c-border)]" aria-hidden />
            <div className="mb-3 text-sm font-semibold text-[var(--c-text)]">Add photos</div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-[12px] border-[1.5px] border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-[14px] font-normal text-[var(--c-text)] btn-primary-interactive"
                onClick={() => {
                  setPhotoPromptOpen(false);
                  openNativePicker("environment");
                }}
              >
                Take photo
              </button>
              <button
                type="button"
                className="w-full rounded-[12px] border-[1.5px] border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-[14px] font-normal text-[var(--c-text)] btn-primary-interactive"
                onClick={() => {
                  setPhotoPromptOpen(false);
                  openNativePicker();
                }}
              >
                Choose from library
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
