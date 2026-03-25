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
        <div className="flex flex-1 flex-col min-h-0 w-full min-h-[100dvh] bg-[var(--color-page-bg)]">
          <div className="flex-1 flex flex-col w-full max-w-full md:max-w-md mx-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] min-h-0">
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
