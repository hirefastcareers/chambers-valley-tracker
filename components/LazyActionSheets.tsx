"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const AddJobSheet = dynamic(() => import("@/components/AddJobSheet"), {
  ssr: false,
  loading: () => null,
});

const QuoteSheet = dynamic(() => import("@/components/QuoteSheet"), {
  ssr: false,
  loading: () => null,
});

/**
 * Keeps AddJobSheet / QuoteSheet off the critical path until opened (or idle preload).
 * Both are large client modules; mounting them on every protected page was a major cost.
 */
export default function LazyActionSheets() {
  const searchParams = useSearchParams();
  const jobOpen =
    searchParams.get("add_job") === "1" ||
    Boolean(searchParams.get("edit_job_id")) ||
    Boolean(searchParams.get("copy_job_id"));
  const quoteOpen = searchParams.get("quote") === "1";

  const [preload, setPreload] = useState(false);

  useEffect(() => {
    if (jobOpen || quoteOpen) return;
    let cancelled = false;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const enable = () => {
      if (!cancelled) setPreload(true);
    };
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(enable, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(enable, 1500);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [jobOpen, quoteOpen]);

  const loadJob = jobOpen || preload;
  const loadQuote = quoteOpen || preload;

  if (!loadJob && !loadQuote) return null;

  return (
    <>
      {loadJob ? <AddJobSheet /> : null}
      {loadQuote ? <QuoteSheet /> : null}
    </>
  );
}
