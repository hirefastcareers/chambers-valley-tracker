import type { ReactNode } from "react";

export default function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        "bg-white rounded-2xl border border-zinc-200 shadow-sm",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

