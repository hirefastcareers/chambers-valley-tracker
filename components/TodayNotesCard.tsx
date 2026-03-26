"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";

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
    <div className="rounded-[14px] border-[1.5px] border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-[var(--color-text-muted)] shrink-0 mt-0.5" aria-hidden>
            <StickyNote className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-[var(--color-text)] flex items-center gap-1.5">Today&apos;s notes</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Quick scratch pad for {new Date().toLocaleDateString("en-GB")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {savedFlash ? (
            <span className="text-xs font-semibold text-[var(--color-accent)] animate-badge-pop">Saved</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-[12px] bg-[var(--color-accent)] text-white text-[15px] font-semibold disabled:opacity-60 btn-primary-interactive"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <textarea
        rows={4}
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Reminders for today…"
        className="mt-3 w-full rounded-[10px] border-[1.5px] border-dashed border-[var(--color-border-strong)] px-[14px] py-[11px] outline-none bg-[var(--color-surface)] text-[var(--color-text)] input-premium text-[15px] leading-normal placeholder:text-[var(--color-text-subtle)]"
      />

      {error ? (
        <div className="mt-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}
