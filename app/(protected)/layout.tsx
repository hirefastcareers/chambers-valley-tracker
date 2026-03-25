import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import AddJobSheet from "@/components/AddJobSheet";
import QuoteSheet from "@/components/QuoteSheet";
import { requireAuth } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 w-full max-w-full md:max-w-md mx-auto px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
      <AddJobSheet />
      <QuoteSheet />
    </div>
  );
}

