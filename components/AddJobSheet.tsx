"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { uploadImageToCloudinaryUnsigned } from "@/lib/cloudinaryUpload";
import { useOptimisticJobs } from "@/components/OptimisticJobsProvider";

type DropdownCustomer = { id: number; name: string };
type PhotoDraft = { id: string; file: File; previewUrl: string; tag: "before" | "after" };

const JOB_TYPE_OPTIONS = [
  "Lawn Mow",
  "Hedge Trim",
  "Garden Clearance",
  "Planting",
  "Landscaping",
  "Other",
] as const;

const STATUS_OPTIONS = [
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "needs_follow_up", label: "Needs follow-up" },
] as const;

function toInputDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const inputClass =
  "mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 bg-[var(--color-white)] text-[var(--color-text)] input-premium";

export default function AddJobSheet() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const optimistic = useOptimisticJobs();

  const addJobOpen = searchParams.get("add_job") === "1";
  const preselectedCustomerId = searchParams.get("customerId");
  const editJobId = searchParams.get("edit_job_id");
  const editing = Boolean(editJobId);

  const [customers, setCustomers] = useState<DropdownCustomer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const defaultDate = useMemo(() => toInputDate(new Date()), []);

  const [customerId, setCustomerId] = useState<string>("");
  const [jobType, setJobType] = useState<(typeof JOB_TYPE_OPTIONS)[number]>("Lawn Mow");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("quoted");
  const [quoteAmount, setQuoteAmount] = useState<string>("");
  const [paid, setPaid] = useState<boolean>(false);
  const [dateDone, setDateDone] = useState<string>(defaultDate);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setStatus("quoted");
    setQuoteAmount("");
    setPaid(false);

    async function hydrateEditJob() {
      if (!editJobId) return;
      try {
        const res = await fetch(`/api/jobs/${editJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        const job = data?.job;
        if (!job) return;

        setCustomerId(String(job.customerId ?? preselectedCustomerId ?? ""));
        setJobType(job.jobType ?? "Lawn Mow");
        setDescription(job.description ?? "");
        setStatus(job.status ?? "quoted");
        setQuoteAmount(job.quoteAmount === null || job.quoteAmount === undefined ? "" : String(job.quoteAmount));
        setPaid(Boolean(job.paid));
        setDateDone(job.dateDone ?? "");
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

    loadCustomers();
    hydrateEditJob();
  }, [addJobOpen, preselectedCustomerId, editJobId, defaultDate]);

  function closeSheet() {
    setClosing(true);
    window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("add_job");
      params.delete("customerId");
      params.delete("edit_job_id");
      router.replace(`${pathname}?${params.toString()}`);
      setClosing(false);
    }, 200);
  }

  const canSave = useMemo(() => {
    if (!customerId) return false;
    if (!jobType) return false;
    if (!dateDone) return false;
    return !busy;
  }, [customerId, jobType, dateDone, busy]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setBusy(true);
    setError(null);

    const cid = Number(customerId);
    const tempId = -Math.abs(Date.now());

    try {
      const photoPayload: { url: string; type: "before" | "after" }[] = [];
      if (photos.length > 0) {
        if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || !process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim()) {
          setError(
            "Photo upload is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to your environment (Vercel + local .env.local), then redeploy."
          );
          return;
        }
        for (const p of photos) {
          try {
            const url = await uploadImageToCloudinaryUnsigned(p.file);
            photoPayload.push({ url, type: p.tag });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Photo upload failed");
            return;
          }
        }
      }

      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("jobType", jobType);
      formData.set("description", description);
      formData.set("status", status);
      formData.set("quoteAmount", quoteAmount);
      formData.set("paid", paid ? "true" : "false");
      formData.set("dateDone", dateDone);

      if (photoPayload.length > 0) {
        formData.set("photoPayload", JSON.stringify(photoPayload));
      }

      if (!editing && Number.isFinite(cid) && optimistic) {
        optimistic.addPending(cid, {
          id: tempId,
          job_type: jobType,
          description: description || null,
          status,
          quote_amount: quoteAmount.trim().length ? quoteAmount : null,
          paid,
          date_done: dateDone,
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
          "absolute left-0 right-0 bottom-0 rounded-t-3xl bg-[var(--color-white)] shadow-[var(--shadow-card)] w-full max-w-full md:max-w-md mx-auto",
          closing ? "sheet-panel-exit" : "sheet-panel-enter",
        ].join(" ")}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <div className="font-display text-lg text-[var(--color-primary)]">{editing ? "Edit Job" : "Add Job"}</div>
            <div className="text-xs text-[var(--color-text-muted)]">Track jobs, photos, and status</div>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            className="px-3 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text)]"
          >
            Close
          </button>
        </div>

        <form
          onSubmit={onSave}
          className="p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] overflow-y-auto max-h-[85vh] sheet-field-stagger flex flex-col gap-4"
        >
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={Boolean(preselectedCustomerId)}
              className={`${inputClass} disabled:opacity-80`}
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
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Customer preselected.</div>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Job type</label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as (typeof JOB_TYPE_OPTIONS)[number])}
              className={inputClass}
            >
              {JOB_TYPE_OPTIONS.map((jt) => (
                <option key={jt} value={jt}>
                  {jt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Description / notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Add details about the job..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]["value"])}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Date done</label>
              <input type="date" value={dateDone} onChange={(e) => setDateDone(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Quote amount (£)</label>
              <input
                inputMode="decimal"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                placeholder="e.g. 120"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[var(--color-text)]">Paid?</label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3 bg-[var(--color-white)]">
                <input
                  type="checkbox"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                  className="w-5 h-5 accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-text)]">{paid ? "Yes" : "No"}</span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text)]">Photos</label>
              <button
                type="button"
                className="text-sm text-[var(--color-primary)] font-semibold"
                onClick={() => fileInputRef.current?.click()}
              >
                Add photos
              </button>
            </div>

            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={onFilesSelected} className="hidden" />

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {photos.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-[var(--color-border)] p-2 bg-[var(--color-white)]">
                    <img src={p.previewUrl} alt="Photo preview" className="w-full h-24 object-cover rounded-xl" />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs flex items-center gap-1 text-[var(--color-text)]">
                          <input
                            type="radio"
                            name={`tag-${p.id}`}
                            checked={p.tag === "before"}
                            onChange={() =>
                              setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, tag: "before" } : x)))
                            }
                          />
                          Before
                        </label>
                        <label className="text-xs flex items-center gap-1 text-[var(--color-text)]">
                          <input
                            type="radio"
                            name={`tag-${p.id}`}
                            checked={p.tag === "after"}
                            onChange={() =>
                              setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, tag: "after" } : x)))
                            }
                          />
                          After
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        className="text-xs text-[var(--color-text-muted)] px-2 py-1 rounded-xl border border-[var(--color-border)]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-[var(--color-text-muted)]">
                Select one or more photos, then tag each as <span className="font-semibold">before</span> or{" "}
                <span className="font-semibold">after</span>.
              </div>
            )}
          </div>

          {error ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-red-bg)] text-[var(--color-red)] px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSave}
            className="w-full rounded-2xl bg-[var(--color-primary)] text-[var(--color-white)] py-3 text-base font-semibold disabled:opacity-60 btn-primary-interactive"
          >
            {busy ? "Saving..." : editing ? "Save changes" : "Save job"}
          </button>
        </form>
      </div>
    </div>
  );
}
