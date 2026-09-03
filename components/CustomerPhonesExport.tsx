"use client";

import { useState } from "react";
import { Copy, Download } from "lucide-react";

function isoDateLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function downloadExport(format: "csv" | "txt") {
  const res = await fetch(`/api/export/customer-phones?format=${format}`);
  if (!res.ok) throw new Error("export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const stamp = isoDateLocal(new Date());
  const a = document.createElement("a");
  a.href = url;
  a.download =
    format === "txt"
      ? `patch-customer-numbers-${stamp}.txt`
      : `patch-customer-numbers-${stamp}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const outlineBtn =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[var(--c-border-strong)] px-4 py-[12px] text-[13px] font-semibold text-[var(--c-text)] disabled:opacity-60";

export default function CustomerPhonesExport() {
  const [busy, setBusy] = useState<"csv" | "txt" | "copy" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onDownload(format: "csv" | "txt") {
    if (busy) return;
    setBusy(format);
    setMessage(null);
    try {
      await downloadExport(format);
    } catch {
      setMessage("Could not export numbers");
    } finally {
      setBusy(null);
    }
  }

  async function onCopy() {
    if (busy) return;
    setBusy("copy");
    setMessage(null);
    try {
      const res = await fetch("/api/export/customer-phones?format=txt");
      if (!res.ok) throw new Error("export failed");
      const text = (await res.text()).trim();
      if (!text) {
        setMessage("No customer phone numbers found");
        return;
      }
      await navigator.clipboard.writeText(text);
      const count = text.split(/\r?\n/).filter(Boolean).length;
      setMessage(`Copied ${count} number${count === 1 ? "" : "s"}`);
    } catch {
      setMessage("Could not copy numbers");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 flex flex-col gap-3">
      <div className="text-[15px] font-semibold text-[var(--c-text)]">Customer numbers for texting</div>
      <p className="text-[13px] text-[var(--c-text-muted)] leading-snug">
        Download every customer with a phone number. CSV includes name, stored number, international
        (E.164) format for SMS tools, and email. The text file is unique numbers only, one per line.
      </p>
      {message ? <div className="text-sm text-[var(--c-text-muted)]">{message}</div> : null}
      <div className="flex flex-col gap-2">
        <button type="button" disabled={busy != null} onClick={() => void onDownload("csv")} className={outlineBtn}>
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {busy === "csv" ? "Exporting…" : "Export CSV"}
        </button>
        <button type="button" disabled={busy != null} onClick={() => void onDownload("txt")} className={outlineBtn}>
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {busy === "txt" ? "Exporting…" : "Export numbers only"}
        </button>
        <button type="button" disabled={busy != null} onClick={() => void onCopy()} className={outlineBtn}>
          <Copy className="h-4 w-4 shrink-0" aria-hidden />
          {busy === "copy" ? "Copying…" : "Copy numbers"}
        </button>
      </div>
    </div>
  );
}
