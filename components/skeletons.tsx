import { cn } from "@/lib/cn";

export function ShimmerBlock({ className }: { className?: string }) {
  return <div className={cn("rounded-[14px] skeleton-shimmer", className)} aria-hidden />;
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex flex-col gap-2">
          <ShimmerBlock className="h-4 w-28" />
          <ShimmerBlock className="h-8 w-44" />
        </div>
        <ShimmerBlock className="h-12 w-12 rounded-full shrink-0" />
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 border border-[var(--color-border)]">
        <ShimmerBlock className="h-5 w-40 mb-3" />
        <ShimmerBlock className="h-24 w-full" />
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden border border-[var(--color-border)]">
        <div className="px-4 py-4 border-b border-[var(--color-border)]">
          <ShimmerBlock className="h-5 w-36" />
          <ShimmerBlock className="h-3 w-20 mt-2" />
        </div>
        <div className="p-4 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[14px] border border-[var(--color-border)] p-3 flex gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <ShimmerBlock className="h-4 w-[60%] max-w-[200px]" />
                <ShimmerBlock className="h-3 w-24" />
                <ShimmerBlock className="h-3 w-full" />
              </div>
              <ShimmerBlock className="h-9 w-16 rounded-[12px] shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden border border-[var(--color-border)]">
        <div className="px-4 py-4 border-b border-[var(--color-border)]">
          <ShimmerBlock className="h-5 w-32" />
        </div>
        <div className="p-4 flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-[14px] border border-[var(--color-border)] p-3">
              <ShimmerBlock className="h-4 w-40 mb-2" />
              <ShimmerBlock className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CustomersListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <ShimmerBlock className="h-8 w-40" />
        <ShimmerBlock className="h-12 w-32 rounded-[20px]" />
      </div>
      <ShimmerBlock className="h-14 w-full rounded-[14px]" />
      <ShimmerBlock className="h-24 w-full rounded-[14px]" />
      <ShimmerBlock className="h-20 w-full rounded-[14px]" />
      <div className="flex flex-col gap-3 pb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 flex justify-between gap-3 border border-[var(--color-border)]"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <ShimmerBlock className="h-5 w-48 max-w-[80%]" />
              <ShimmerBlock className="h-4 w-36" />
              <ShimmerBlock className="h-3 w-44" />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <ShimmerBlock className="h-9 w-16 rounded-[12px]" />
              <ShimmerBlock className="h-9 w-16 rounded-[12px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[var(--shadow-sm)]">
        <ShimmerBlock className="h-8 w-2/3 max-w-xs mb-2" />
        <ShimmerBlock className="h-4 w-40" />
        <div className="flex gap-2 mt-4">
          <ShimmerBlock className="h-10 w-24 rounded-[12px]" />
          <ShimmerBlock className="h-10 w-20 rounded-[10px]" />
        </div>
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 space-y-3 border border-[var(--color-border)]">
        <ShimmerBlock className="h-5 w-36" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <ShimmerBlock className="h-3 w-16" />
            <ShimmerBlock className="h-10 w-full rounded-[10px]" />
          </div>
        ))}
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 border border-[var(--color-border)]">
        <ShimmerBlock className="h-5 w-28 mb-4" />
        <ShimmerBlock className="h-24 w-full rounded-[10px]" />
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 border border-[var(--color-border)]">
        <ShimmerBlock className="h-5 w-32 mb-4" />
        {[1, 2].map((i) => (
          <div key={i} className="rounded-[14px] border border-[var(--color-border)] p-3 mb-3 flex justify-between">
            <div className="space-y-2 flex-1">
              <ShimmerBlock className="h-4 w-32" />
              <ShimmerBlock className="h-3 w-full" />
            </div>
            <ShimmerBlock className="h-9 w-14 rounded-[12px] ml-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EarningsSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="space-y-2">
        <ShimmerBlock className="h-8 w-36" />
        <ShimmerBlock className="h-4 w-full max-w-sm" />
      </div>

      <div className="grid grid-cols-1 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 border border-[var(--color-border)]">
            <ShimmerBlock className="h-3 w-24 mb-2" />
            <ShimmerBlock className="h-10 w-40" />
          </div>
        ))}
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 border border-[var(--color-border)]">
        <ShimmerBlock className="h-5 w-48 mb-2" />
        <ShimmerBlock className="h-4 w-full max-w-md mb-4" />
        <ShimmerBlock className="h-8 w-56" />
      </div>

      <div className="rounded-[14px] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 border border-[var(--color-border)]">
        <ShimmerBlock className="h-5 w-40 mb-2" />
        <ShimmerBlock className="h-3 w-52 mb-4" />
        <ShimmerBlock className="h-72 w-full rounded-[10px]" />
      </div>
    </div>
  );
}
