import type { ReactNode } from "react";
import { Suspense } from "react";
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
        <div className="flex flex-1 flex-col min-h-0 w-full min-h-[100dvh] bg-[var(--color-bg)]">
          <div className="flex min-h-0 flex-1 flex-col w-full max-w-full md:max-w-md mx-auto px-4 pt-0 pb-[var(--nav-padding-bottom)] bg-[var(--color-bg)]">
            {children}
          </div>
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
          <Suspense fallback={null}>
            <AddJobSheet />
          </Suspense>
          <Suspense fallback={null}>
            <QuoteSheet />
          </Suspense>
        </div>
      </OptimisticJobsProvider>
    </OptimisticCustomersProvider>
  );
}
