"use client";

import { useEffect, useState } from "react";
import { requestOneSignalPermission } from "@/lib/onesignal";

const DELAY_MS = 4000;

function shouldShowPrompt(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission !== "granted" && Notification.permission !== "denied";
}

export default function DashboardNotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShowPrompt()) return;

    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      if (!shouldShowPrompt()) return;
      setVisible(true);
    }, DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  function onNotNow() {
    setVisible(false);
  }

  async function onEnable() {
    try {
      const granted = await requestOneSignalPermission();
      if (granted || (typeof window !== "undefined" && Notification.permission === "granted")) {
        setVisible(false);
      }
    } catch (error) {
      console.error("[OneSignal] enable notifications failed:", error);
    }
  }

  if (!visible) return null;

  return (
    <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 mt-3 shadow-sm">
      <div className="text-[15px] font-semibold text-[var(--c-text)]">Enable reminders</div>
      <p className="text-[13px] text-[var(--c-text-muted)] mt-2 leading-snug">
        Get notified each morning about today&apos;s jobs and overdue follow-ups
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => void onEnable()}
          className="inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-[13px] font-semibold btn-primary-solid btn-primary-interactive !py-[10px]"
        >
          Enable notifications
        </button>
        <button
          type="button"
          onClick={onNotNow}
          className="inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-[13px] font-medium border-[1.5px] border-[var(--c-border)] text-[var(--c-text)]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
