import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-[var(--color-white)] rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-card)] overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
