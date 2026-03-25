import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-[var(--color-white)] rounded-2xl border border-[rgba(26,71,49,0.08)] shadow-[var(--shadow-card)] overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
