"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  hiddenCustomerIds: ReadonlySet<number>;
  hideCustomerOptimistic: (id: number) => void;
  unhideCustomer: (id: number) => void;
  optimisticPrepends: { tempId: number; name: string; phone: string | null }[];
  prependCustomer: (row: { tempId: number; name: string; phone: string | null }) => void;
  removePrepended: (tempId: number) => void;
};

const OptimisticCustomersContext = createContext<Ctx | null>(null);

export function OptimisticCustomersProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [optimisticPrepends, setOptimisticPrepends] = useState<
    { tempId: number; name: string; phone: string | null }[]
  >([]);

  const hideCustomerOptimistic = useCallback((id: number) => {
    setHidden((prev) => new Set(prev).add(id));
  }, []);

  const unhideCustomer = useCallback((id: number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const prependCustomer = useCallback((row: { tempId: number; name: string; phone: string | null }) => {
    setOptimisticPrepends((prev) => {
      if (prev.some((p) => p.tempId === row.tempId)) return prev;
      return [row, ...prev];
    });
  }, []);

  const removePrepended = useCallback((tempId: number) => {
    setOptimisticPrepends((prev) => prev.filter((p) => p.tempId !== tempId));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      hiddenCustomerIds: hidden,
      hideCustomerOptimistic,
      unhideCustomer,
      optimisticPrepends,
      prependCustomer,
      removePrepended,
    }),
    [hidden, hideCustomerOptimistic, unhideCustomer, optimisticPrepends, prependCustomer, removePrepended]
  );

  return <OptimisticCustomersContext.Provider value={value}>{children}</OptimisticCustomersContext.Provider>;
}

export function useOptimisticCustomers() {
  return useContext(OptimisticCustomersContext);
}
