import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Full-bleed deep green banner; use as first child inside protected layout (cancels horizontal padding). */
export default function PageHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-4 -mt-[max(1rem,env(safe-area-inset-top))] relative z-0 mb-6", className)}>
      <div
        className="relative overflow-x-hidden overflow-y-visible bg-[#1a4731] text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] rounded-b-2xl"
        style={{
          backgroundImage: "radial-gradient(ellipse at top right, #2d6a4f 0%, #1a4731 70%)",
        }}
      >
        <div className="pt-[calc(44px+env(safe-area-inset-top))] px-6 pb-9">{children}</div>
      </div>
    </div>
  );
}
