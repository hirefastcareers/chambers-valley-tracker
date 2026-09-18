import type { ReactNode } from "react";
import { Suspense } from "react";
import BottomNav from "@/components/BottomNav";
import LazyActionSheets from "@/components/LazyActionSheets";
import ProtectedShell from "@/components/ProtectedShell";
import { requireAuth, requireOnboardingComplete } from "@/lib/auth";
import { OptimisticCustomersProvider } from "@/components/OptimisticCustomersProvider";
import { OptimisticJobsProvider } from "@/components/OptimisticJobsProvider";
import { JobPhotoPromptProvider } from "@/components/JobPhotoPromptProvider";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const userId = await requireAuth();
  await requireOnboardingComplete(userId);
  return (
    <OptimisticCustomersProvider>
      <OptimisticJobsProvider>
        <JobPhotoPromptProvider>
          <div className="flex flex-1 flex-col min-h-0 w-full min-h-[100dvh] bg-[var(--c-bg)]">
            <ProtectedShell>{children}</ProtectedShell>
            <Suspense fallback={null}>
              <BottomNav />
            </Suspense>
            <Suspense fallback={null}>
              <LazyActionSheets />
            </Suspense>
          </div>
        </JobPhotoPromptProvider>
      </OptimisticJobsProvider>
    </OptimisticCustomersProvider>
  );
}
