"use client";

import { useState } from "react";

export default function TodayNotesCard({ initialNoteText }: { initialNoteText: string }) {
  const [noteText, setNoteText] = useState(initialNoteText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Could not save notes");
        return;
      }
    } catch {
      setError("Could not save notes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[#2d6a4f] font-semibold">Today&apos;s Notes</div>
          <div className="text-xs text-zinc-600 mt-1">Quick scratch pad for {new Date().toLocaleDateString("en-GB")}</div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-[#2d6a4f] text-white text-sm font-semibold disabled:opacity-60 active:scale-[0.99]"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>

      <textarea
        rows={4}
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="e.g. pick up compost, call Janet"
        className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-3 outline-none focus:ring-2 focus:ring-[#52b788]"
      />

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}

