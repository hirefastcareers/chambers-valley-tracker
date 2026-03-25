import type { ReactNode } from "react";

export default function ProtectedTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-enter w-full">{children}</div>;
}
