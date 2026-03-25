import { ShimmerBlock } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <ShimmerBlock className="h-8 w-40" />
        <ShimmerBlock className="h-10 w-20 rounded-xl" />
      </div>
      <ShimmerBlock className="h-12 w-full rounded-xl" />
      <ShimmerBlock className="h-24 w-full rounded-xl" />
      <ShimmerBlock className="h-32 w-full rounded-xl" />
      <ShimmerBlock className="h-12 w-full rounded-2xl" />
    </div>
  );
}
