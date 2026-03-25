"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkFollowUpDoneButton({ followUpId }: { followUpId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onMarkDone() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/follow-ups/${followUpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onMarkDone}
      disabled={busy}
      className="px-3 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60 active:scale-[0.98]"
    >
      {busy ? "Done..." : "Done"}
    </button>
  );
}

