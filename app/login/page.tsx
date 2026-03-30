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
    <div className="min-h-full w-full flex flex-1 flex-col items-center justify-center bg-[var(--c-bg)] px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-full md:max-w-md bg-[var(--c-surface)] rounded-[12px] p-6 border border-[var(--c-border)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-[10px] bg-[var(--c-primary)] flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[var(--c-text)] font-semibold text-[17px] leading-tight">Patch</div>
            <div className="text-[var(--c-text-muted)] text-[13px]">Job tracker</div>
          </div>
        </div>

        <h1 className="text-[22px] font-semibold text-[var(--c-text)] mb-2">Enter password</h1>
        <p className="text-[13px] text-[var(--c-text-muted)] mb-5">Protected access only.</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="text-sm font-normal text-[var(--c-text)]">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="mt-2 w-full rounded-[10px] border-[1.5px] border-[var(--c-border)] px-[14px] py-[11px] text-[15px] outline-none bg-[var(--c-surface)] text-[var(--c-text)] input-premium placeholder:text-[var(--c-text-subtle)]"
            />
          </label>

          {error ? (
            <div className="rounded-[10px] border border-[var(--c-border)] bg-[rgba(220,38,38,0.08)] text-[var(--c-danger)] px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 w-full btn-primary-solid disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      <div className="h-8" />
    </div>
  );
}
