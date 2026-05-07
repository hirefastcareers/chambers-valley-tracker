"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { uploadImageToCloudinaryUnsigned } from "@/lib/cloudinaryUpload";

type PhotoDraft = {
  id: string;
  file: File;
  previewUrl: string;
  tag: "before" | "after";
  shareToGallery: boolean;
};

type ContextValue = {
  promptForJobPhotos: (jobId: number) => Promise<void>;
  showToast: (message: string) => void;
  openFacebookPostSheet: (jobId: number) => void;
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

  const [facebookOpen, setFacebookOpen] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbRegenerating, setFbRegenerating] = useState(false);
  const [fbPostText, setFbPostText] = useState("");
  const [fbAfterUrls, setFbAfterUrls] = useState<string[]>([]);
  const [fbBeforeUrls, setFbBeforeUrls] = useState<string[]>([]);
  const [copyLabel, setCopyLabel] = useState<"copy" | "copied">("copy");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
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
      shareToGallery: false,
    }));

    setPhotos((prev) => [...prev, ...drafts]);
    setSourceSheetOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function savePhotos() {
    if (!jobId || photos.length === 0 || saving) return;
    setSaving(true);
    try {
      const payload: { url: string; type: "before" | "after"; tags: string[]; cloudinaryPublicId: string }[] = [];
      for (const p of photos) {
        const tags = ["patch", p.tag];
        if (p.shareToGallery) tags.push("gallery");
        const upload = await uploadImageToCloudinaryUnsigned(p.file, { tags });
        payload.push({ url: upload.secureUrl, type: p.tag, tags, cloudinaryPublicId: upload.publicId });
      }

      const res = await fetch(`/api/jobs/${jobId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: payload }),
      });
      if (!res.ok) return;

      setSourceSheetOpen(false);
      clearPhotos();
      showToast("Photos saved ✓");
    } finally {
      setSaving(false);
    }
  }

  async function fetchPhotoUrls(activeJobId: number) {
    const res = await fetch(`/api/jobs/${activeJobId}/photos?urls=1`);
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; afterUrls?: string[]; beforeUrls?: string[] }
      | null;
    if (!data?.ok) {
      return { afterUrls: [] as string[], beforeUrls: [] as string[] };
    }
    return {
      afterUrls: Array.isArray(data.afterUrls) ? data.afterUrls : [],
      beforeUrls: Array.isArray(data.beforeUrls) ? data.beforeUrls : [],
    };
  }

  async function fetchGeneratedPost(activeJobId: number) {
    const fallback = "Could not generate post — please write your own";
    try {
      const res = await fetch("/api/generate-facebook-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: activeJobId }),
      });
      const data = (await res.json().catch(() => null)) as { post_text?: unknown } | null;
      const text = typeof data?.post_text === "string" ? data.post_text.trim() : "";
      if (text.length > 0) return text;
    } catch {
      // Network or parse error
    }
    return fallback;
  }

  function openFacebookPostSheet(nextJobId: number) {
    if (!Number.isFinite(nextJobId) || nextJobId <= 0) return;
    setJobId(nextJobId);
    setPromptOpen(false);
    setSourceSheetOpen(false);
    setFacebookOpen(true);
    setFbLoading(true);
    setFbRegenerating(false);
    setFbPostText("");
    setFbAfterUrls([]);
    setFbBeforeUrls([]);
    setCopyLabel("copy");

    void (async () => {
      try {
        const [urls, postText] = await Promise.all([fetchPhotoUrls(nextJobId), fetchGeneratedPost(nextJobId)]);
        setFbAfterUrls(urls.afterUrls);
        setFbBeforeUrls(urls.beforeUrls);
        setFbPostText(postText);
      } finally {
        setFbLoading(false);
      }
    })();
  }

  async function regeneratePost() {
    if (!jobId) return;
    const activeJobId = jobId;
    setFbRegenerating(true);
    try {
      const postText = await fetchGeneratedPost(activeJobId);
      setFbPostText(postText);
    } finally {
      setFbRegenerating(false);
    }
  }

  async function copyPostText() {
    const t = fbPostText.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      showToast("Could not copy");
      return;
    }
    setCopyLabel("copied");
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      setCopyLabel("copy");
      copyTimerRef.current = null;
    }, 2000);
  }

  function closeFacebookSheet() {
    setFacebookOpen(false);
    setFbLoading(false);
    setFbRegenerating(false);
  }

  return (
    <JobPhotoPromptContext.Provider value={{ promptForJobPhotos, showToast, openFacebookPostSheet }}>
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
                          setPhotos((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, tag: "before", shareToGallery: false } : x))
                          )
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
                          setPhotos((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, tag: "after", shareToGallery: true } : x))
                          )
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

      {facebookOpen ? (
        <div className="fixed inset-0 z-[125]">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={closeFacebookSheet}
            aria-label="Close Facebook share sheet"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] w-full max-w-full overflow-y-auto rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 md:max-w-md">
            <div className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-[var(--c-border)]" aria-hidden />
            <h3 className="text-[18px] font-semibold text-[var(--c-text)]">Share to Facebook</h3>
            <p className="mt-1 text-[13px] text-[var(--c-text-muted)]">AI-generated post ready to copy</p>

            {fbLoading ? (
              <div className="mt-5 space-y-3" aria-busy="true" aria-live="polite">
                <p className="text-[13px] font-medium text-[var(--c-text-muted)]">Generating your post...</p>
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded-md bg-[var(--c-border)]" />
                  <div className="h-4 w-[92%] animate-pulse rounded-md bg-[var(--c-border)]" />
                  <div className="h-4 w-[85%] animate-pulse rounded-md bg-[var(--c-border)]" />
                  <div className="h-4 w-[70%] animate-pulse rounded-md bg-[var(--c-border)]" />
                </div>
              </div>
            ) : (
              <>
                {fbAfterUrls.length > 0 ? (
                  <div className="mt-4">
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {fbAfterUrls.map((url) => (
                        <div key={url} className="shrink-0 w-[80px]">
                          <img
                            src={url}
                            alt=""
                            width={80}
                            height={80}
                            className="h-20 w-20 rounded-lg object-cover"
                            style={{ borderRadius: 8 }}
                          />
                          <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--c-primary)]">
                            After
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {fbBeforeUrls.length > 0 ? (
                  <div className="mt-4">
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {fbBeforeUrls.map((url) => (
                        <div key={url} className="shrink-0 w-[80px]">
                          <img
                            src={url}
                            alt=""
                            width={80}
                            height={80}
                            className="h-20 w-20 rounded-lg object-cover"
                            style={{ borderRadius: 8 }}
                          />
                          <div className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-muted)]">
                            Before
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <p className="mt-3 text-[12px] text-[var(--c-text-muted)]">
                  Upload these photos manually when posting to Facebook
                </p>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void regeneratePost()}
                    disabled={fbRegenerating}
                    className="text-[13px] font-medium text-[var(--c-info)] disabled:opacity-50"
                  >
                    Not happy? Regenerate →
                  </button>
                </div>

                {fbRegenerating ? (
                  <div className="mt-3 space-y-2" aria-busy="true">
                    <div className="h-4 w-full animate-pulse rounded-md bg-[var(--c-border)]" />
                    <div className="h-4 w-[90%] animate-pulse rounded-md bg-[var(--c-border)]" />
                    <div className="h-4 w-[75%] animate-pulse rounded-md bg-[var(--c-border)]" />
                  </div>
                ) : (
                  <textarea
                    value={fbPostText}
                    onChange={(e) => setFbPostText(e.target.value)}
                    rows={8}
                    className="mt-2 w-full resize-y border border-[var(--c-border)] text-[var(--c-text)] outline-none focus:ring-2 focus:ring-[var(--c-info)]"
                    style={{
                      background: "#f9fafb",
                      borderRadius: 10,
                      padding: 14,
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  />
                )}

                <div className="mt-4 flex flex-col gap-2 pb-2">
                  <button
                    type="button"
                    className="w-full rounded-[12px] bg-[var(--c-primary)] px-4 py-3 text-[15px] font-semibold text-white btn-primary-interactive"
                    onClick={() => void copyPostText()}
                    disabled={fbRegenerating}
                  >
                    {copyLabel === "copied" ? "Copied ✓" : "Copy post text"}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-[12px] border border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-3 text-[15px] font-semibold text-[var(--c-text)] btn-outline-interactive"
                    onClick={() =>
                      window.open(
                        "https://www.facebook.com/profile.php?id=61575096380078",
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    Open Facebook page
                  </button>
                </div>
              </>
            )}
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
