import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import AddJobSheet from "@/components/AddJobSheet";
import QuoteSheet from "@/components/QuoteSheet";
import { requireAuth } from "@/lib/auth";
import { OptimisticCustomersProvider } from "@/components/OptimisticCustomersProvider";
import { OptimisticJobsProvider } from "@/components/OptimisticJobsProvider";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireAuth();
  return (
    <OptimisticCustomersProvider>
      <OptimisticJobsProvider>
        <div className="min-h-screen flex flex-col bg-[var(--color-surface)]">
          <div className="flex-1 w-full max-w-full md:max-w-md mx-auto px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
          <BottomNav />
          <AddJobSheet />
          <QuoteSheet />
        </div>
      </OptimisticJobsProvider>
    </OptimisticCustomersProvider>
  );
}
