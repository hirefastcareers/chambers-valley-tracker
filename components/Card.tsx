import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-[var(--c-surface)] rounded-[12px] border border-[var(--c-border)] overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
