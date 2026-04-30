"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { uploadImageToCloudinaryUnsigned } from "@/lib/cloudinaryUpload";

type PhotoDraft = {
  id: string;
  file: File;
  previewUrl: string;
  tag: "before" | "after";
};

type ContextValue = {
  promptForJobPhotos: (jobId: number) => Promise<void>;
  showToast: (message: string) => void;
};

const JobPhotoPromptContext = createContext<ContextValue | null>(null);

export function JobPhotoPromptProvider({ children }: { children: ReactNode }) {
  const [jobId, setJobId] = useState<number | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<"environment" | undefined>(undefined);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearPhotos() {
    setPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  }

  async function promptForJobPhotos(nextJobId: number) {
    if (!Number.isFinite(nextJobId) || nextJobId <= 0) return;
    try {
      const res = await fetch(`/api/jobs/${nextJobId}/photos`);
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as { hasPhotos?: boolean } | null;
      if (data?.hasPhotos) return;
      setJobId(nextJobId);
      clearPhotos();
      setPromptOpen(true);
      setSourceSheetOpen(false);
    } catch {
      // Best-effort UX only.
    }
  }

  function openNativePicker(mode?: "environment") {
    setCaptureMode(mode);
    window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }

  function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const drafts: PhotoDraft[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      tag: "before",
    }));

    setPhotos((prev) => [...prev, ...drafts]);
    setSourceSheetOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function savePhotos() {
    if (!jobId || photos.length === 0 || saving) return;
    setSaving(true);
    try {
      const payload: { url: string; type: "before" | "after" }[] = [];
      for (const p of photos) {
        const url = await uploadImageToCloudinaryUnsigned(p.file);
        payload.push({ url, type: p.tag });
      }

      const res = await fetch(`/api/jobs/${jobId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: payload }),
      });
      if (!res.ok) return;

      setPromptOpen(false);
      setSourceSheetOpen(false);
      clearPhotos();
      showToast("Photos saved ✓");
    } finally {
      setSaving(false);
    }
  }

  return (
    <JobPhotoPromptContext.Provider value={{ promptForJobPhotos, showToast }}>
      {children}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        capture={captureMode}
        onChange={onFilesSelected}
        className="hidden"
      />

      {toast ? (
        <div className="pointer-events-none fixed top-4 left-1/2 z-[120] -translate-x-1/2">
          <div className="rounded-[20px] bg-[#0a0a0a] px-4 py-2 text-[13px] text-white shadow-md animate-[fadeInOut_2.5s_ease]">
            {toast}
          </div>
        </div>
      ) : null}

      {promptOpen ? (
        <div className="fixed inset-0 z-[110]">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setPromptOpen(false)}
            aria-label="Close add photos prompt"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-full rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 md:max-w-md">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--c-border)]" aria-hidden />
            <h3 className="text-[18px] font-semibold text-[var(--c-text)]">Add job photos?</h3>
            <p className="mt-1 text-[13px] text-[var(--c-text-muted)]">
              Would you like to add before and after photos for this job?
            </p>

            {photos.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {photos.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-[var(--c-border)] p-2">
                    <img src={p.previewUrl} alt="Photo preview" className="h-24 w-full rounded-xl object-cover" />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, tag: "before" } : x)))
                        }
                        className={[
                          "flex-1 rounded-[10px] border px-2 py-1.5 text-xs font-semibold",
                          p.tag === "before"
                            ? "border-[var(--c-primary)] bg-[var(--c-primary)] text-white"
                            : "border-[var(--c-border)] text-[var(--c-text)]",
                        ].join(" ")}
                      >
                        Before
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, tag: "after" } : x)))
                        }
                        className={[
                          "flex-1 rounded-[10px] border px-2 py-1.5 text-xs font-semibold",
                          p.tag === "after"
                            ? "border-[var(--c-primary)] bg-[var(--c-primary)] text-white"
                            : "border-[var(--c-border)] text-[var(--c-text)]",
                        ].join(" ")}
                      >
                        After
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-[12px] bg-[var(--c-primary)] px-4 py-3 text-[15px] font-semibold text-white btn-primary-interactive"
                onClick={() => (photos.length > 0 ? void savePhotos() : setSourceSheetOpen(true))}
                disabled={saving}
              >
                {photos.length > 0 ? (saving ? "Saving..." : "Confirm & save") : "Add photos"}
              </button>
              <button
                type="button"
                className="w-full rounded-[12px] border border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-3 text-[15px] font-semibold text-[var(--c-text)] btn-outline-interactive"
                onClick={() => setPromptOpen(false)}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sourceSheetOpen ? (
        <div className="fixed inset-0 z-[115]">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setSourceSheetOpen(false)}
            aria-label="Close photo options"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-full rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 md:max-w-md">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--c-border)]" aria-hidden />
            <div className="mb-3 text-sm font-semibold text-[var(--c-text)]">Add photos</div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-[12px] border-[1.5px] border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-[14px] text-[var(--c-text)] btn-primary-interactive"
                onClick={() => openNativePicker("environment")}
              >
                Take photo
              </button>
              <button
                type="button"
                className="w-full rounded-[12px] border-[1.5px] border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-[14px] text-[var(--c-text)] btn-primary-interactive"
                onClick={() => openNativePicker()}
              >
                Choose from library
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </JobPhotoPromptContext.Provider>
  );
}

export function useJobPhotoPrompt() {
  const ctx = useContext(JobPhotoPromptContext);
  if (!ctx) {
    throw new Error("useJobPhotoPrompt must be used inside JobPhotoPromptProvider");
  }
  return ctx;
}

