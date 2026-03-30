"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { JobStatus } from "@/lib/status";

export type OptimisticJob = {
  id: number;
  job_type: string;
  description: string | null;
  status: JobStatus;
  quote_amount: string | number | null;
  paid: boolean;
  date_done: string | null;
  time_of_day: "am" | "pm" | "all_day";
  photos: { id: number; cloudinary_url: string; type: "before" | "after" }[];
};

type Ctx = {
  getPendingForCustomer: (customerId: number) => OptimisticJob[];
  addPending: (customerId: number, job: OptimisticJob) => void;
  removePending: (customerId: number, jobId: number) => void;
  clearForCustomer: (customerId: number) => void;
};

const OptimisticJobsContext = createContext<Ctx | null>(null);

export function OptimisticJobsProvider({ children }: { children: ReactNode }) {
  const [pendingByCustomer, setPendingByCustomer] = useState<Map<number, OptimisticJob[]>>(() => new Map());

  const getPendingForCustomer = useCallback((customerId: number) => {
    return pendingByCustomer.get(customerId) ?? [];
  }, [pendingByCustomer]);

  const addPending = useCallback((customerId: number, job: OptimisticJob) => {
    setPendingByCustomer((prev) => {
      const next = new Map(prev);
      const list = [...(next.get(customerId) ?? [])];
      if (!list.some((j) => j.id === job.id)) list.unshift(job);
      next.set(customerId, list);
      return next;
    });
  }, []);

  const removePending = useCallback((customerId: number, jobId: number) => {
    setPendingByCustomer((prev) => {
      const next = new Map(prev);
      const list = (next.get(customerId) ?? []).filter((j) => j.id !== jobId);
      if (list.length === 0) next.delete(customerId);
      else next.set(customerId, list);
      return next;
    });
  }, []);

  const clearForCustomer = useCallback((customerId: number) => {
    setPendingByCustomer((prev) => {
      const next = new Map(prev);
      next.delete(customerId);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      getPendingForCustomer,
      addPending,
      removePending,
      clearForCustomer,
    }),
    [getPendingForCustomer, addPending, removePending, clearForCustomer]
  );

  return <OptimisticJobsContext.Provider value={value}>{children}</OptimisticJobsContext.Provider>;
}

export function useOptimisticJobs() {
  return useContext(OptimisticJobsContext);
}
