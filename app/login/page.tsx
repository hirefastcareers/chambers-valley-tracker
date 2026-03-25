"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-full w-full flex flex-1 flex-col items-center justify-center bg-[#2d6a4f] px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-full md:max-w-md bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#52b788] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 4C7 4 4 13 4 20c7 0 16-3 16-16Z" />
              <path d="M4 20c4-6 8-10 16-16" />
            </svg>
          </div>
          <div>
            <div className="text-[#2d6a4f] font-semibold text-lg leading-tight">Chambers Valley Garden Care</div>
            <div className="text-[#2d6a4f] text-sm">Job Tracker</div>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-[#171717] mb-2">Enter password</h1>
        <p className="text-sm text-zinc-600 mb-5">Protected access only.</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-zinc-700">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[#52b788]"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 w-full rounded-xl bg-[#2d6a4f] text-white py-3 text-base font-semibold disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      <div className="h-8" />
    </div>
  );
}

