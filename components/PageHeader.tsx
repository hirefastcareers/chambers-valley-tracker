import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Flat minimal header: page background, safe-area top, bottom border. */
export default function PageHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "-mx-4 px-4 mb-6 border-b border-[var(--color-border)] bg-[var(--color-bg)]",
        "pt-[max(20px,env(safe-area-inset-top))] pb-4",
        className
      )}
    >
      {children}
    </header>
  );
}
