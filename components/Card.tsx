import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export default function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-[var(--color-surface)] rounded-[14px] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
