"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Widens the content column on landscape-friendly pages (e.g. week timetable). */
export default function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isTimetable = pathname === "/timetable";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col w-full mx-auto px-4 pt-0 pb-[var(--nav-padding-bottom)] bg-[var(--c-bg)]",
        isTimetable
          ? "timetable-shell max-w-full md:max-w-none"
          : "max-w-full md:max-w-md"
      )}
      data-page={isTimetable ? "timetable" : undefined}
    >
      {children}
    </div>
  );
}
