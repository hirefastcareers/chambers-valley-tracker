"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [from] = useState(() => {
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    return params.get("from") ?? "/";
  });

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => password.trim().length > 0 && !busy, [password, busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Login failed");
        setBusy(false);
        return;
      }

      router.replace(from);
    } catch {
      setError("Could not reach server");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full w-full flex flex-1 flex-col items-center justify-center bg-[var(--color-bg)] px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-full md:max-w-md bg-[var(--color-surface)] rounded-[14px] shadow-[var(--shadow-md)] p-6 border border-[var(--color-border)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-[10px] bg-[var(--color-primary)] flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[var(--color-text)] font-bold text-lg leading-tight">Patch</div>
            <div className="text-[var(--color-text-muted)] text-sm">Job tracker</div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">Enter password</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">Protected access only.</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-[var(--color-text)]">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--color-border)] px-[14px] py-[11px] text-[15px] outline-none bg-[var(--color-surface)] text-[var(--color-text)] input-premium placeholder:text-[var(--color-text-subtle)]"
            />
          </label>

          {error ? (
            <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 w-full rounded-[12px] bg-[var(--color-primary)] text-white py-[13px] text-[15px] font-semibold disabled:opacity-60 btn-primary-interactive"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      <div className="h-8" />
    </div>
  );
}
