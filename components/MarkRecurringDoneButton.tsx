"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkRecurringDoneButton({ reminderId }: { reminderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDone() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recurring-reminders/${reminderId}/done`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDone}
      disabled={busy}
      className="px-3 py-2 rounded-xl bg-[#2d6a4f] text-white text-sm font-semibold disabled:opacity-60 active:scale-[0.98]"
    >
      {busy ? "Updating..." : "Done"}
    </button>
  );
}

