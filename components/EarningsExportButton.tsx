"use client";

import { useState } from "react";
import { Download } from "lucide-react";

function isoDateLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function EarningsExportButton() {
  const [loading, setLoading] = useState(false);

  async function onExport() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/export/earnings");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const stamp = isoDateLocal(new Date());
      const a = document.createElement("a");
      a.href = url;
      a.download = `patch-earnings-${stamp}.csv`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onExport()}
      disabled={loading}
      className="inline-flex items-center gap-2 shrink-0 disabled:opacity-60"
      style={{
        border: "1px solid var(--c-border-strong)",
        background: "white",
        color: "var(--c-text)",
        borderRadius: 8,
        padding: "6px 14px",
        fontSize: 13,
      }}
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      {loading ? "Exporting…" : "Export CSV"}
    </button>
  );
}
