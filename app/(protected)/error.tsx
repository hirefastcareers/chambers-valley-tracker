"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ProtectedSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[protected:error]", error.message, error.digest ?? "", error.stack ?? "");
  }, [error]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <h1 className="text-[18px] font-semibold text-[var(--c-text)]">Something went wrong</h1>
      <p className="text-[14px] text-[var(--c-text-muted)] max-w-sm leading-snug">
        This page could not be loaded. You can try again, or go back to customers.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-[10px] border-[1.5px] border-[var(--c-border-strong)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--c-text)]"
        >
          Try again
        </button>
        <Link
          href="/customers"
          className="rounded-[10px] border-[1.5px] border-[var(--c-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--c-text)]"
        >
          Customers
        </Link>
      </div>
    </div>
  );
}
