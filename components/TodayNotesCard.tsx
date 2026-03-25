"use client";

import { useState } from "react";

export default function TodayNotesCard({ initialNoteText }: { initialNoteText: string }) {
  const [noteText, setNoteText] = useState(initialNoteText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function save() {
    if (busy) return;
    const previous = noteText;
    setSavedFlash(true);
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/dashboard-notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteText }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(typeof data?.error === "string" ? data.error : "Could not save notes");
          setNoteText(previous);
          setSavedFlash(false);
          return;
        }
        window.setTimeout(() => setSavedFlash(false), 1200);
      } catch {
        setError("Could not save notes");
        setNoteText(previous);
        setSavedFlash(false);
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <div className="rounded-2xl border border-[rgba(26,71,49,0.08)] bg-[#f6faf6] shadow-[var(--shadow-card)] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-lg shrink-0 mt-0.5" aria-hidden>
            📝
          </span>
          <div>
            <div className="text-[#1a4731] font-semibold text-[15px] flex items-center gap-1.5">
              Today&apos;s Notes
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Quick scratch pad for {new Date().toLocaleDateString("en-GB")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {savedFlash ? (
            <span className="text-xs font-semibold text-[var(--color-primary)] animate-badge-pop">Saved</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-white)] text-sm font-semibold disabled:opacity-60 btn-primary-interactive"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <textarea
        rows={4}
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="e.g. pick up compost, call Janet"
        className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-[#b7e4c7] px-3 py-3 outline-none bg-[var(--color-white)] text-[var(--color-text)] input-premium"
      />

      {error ? (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-red-bg)] text-[var(--color-red)] px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}
