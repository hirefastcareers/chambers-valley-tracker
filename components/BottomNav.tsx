"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
};

function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="w-6 h-6 inline-flex items-center justify-center">{children}</span>;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionsOpen, setActionsOpen] = useState(false);

  const items = useMemo<NavItem[]>(() => {
    const atDashboard = pathname === "/" || pathname === "/dashboard";
    const atCustomers = pathname.startsWith("/customers");
    const atEarnings = pathname === "/earnings";

    return [
      {
        href: "/",
        label: "Dashboard",
        isActive: atDashboard,
        icon: (
          <IconBox>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7" />
              <path d="M9 22V12h6v10" />
            </svg>
          </IconBox>
        ),
      },
      {
        href: "/customers",
        label: "Customers",
        isActive: atCustomers,
        icon: (
          <IconBox>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <path d="M20 8v6" />
              <path d="M23 11h-6" />
            </svg>
          </IconBox>
        ),
      },
      {
        href: "/earnings",
        label: "Earnings",
        isActive: atEarnings,
        icon: (
          <IconBox>
            <span className="text-xl font-bold leading-none">£</span>
          </IconBox>
        ),
      },
    ];
  }, [pathname]);

  function openAddJob() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("add_job", "1");
    params.delete("quote");
    params.delete("edit_job_id");
    setActionsOpen(false);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function openQuote() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("quote", "1");
    params.delete("add_job");
    params.delete("edit_job_id");
    setActionsOpen(false);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur px-2 safe-area-inset-bottom">
        <div className="max-w-md mx-auto flex items-stretch justify-between">
          {items.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={[
                "flex-1 py-3 rounded-xl flex flex-col items-center justify-center gap-1",
                item.isActive ? "text-[#2d6a4f] font-semibold" : "text-zinc-600",
                "active:scale-[0.98]",
              ].join(" ")}
              aria-label={item.label}
            >
              <span className={item.isActive ? "text-[#2d6a4f]" : "text-zinc-500"}>{item.icon}</span>
              <span className="text-[11px] leading-tight">{item.label}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setActionsOpen((v) => !v)}
            className="flex-1 py-3 rounded-xl bg-[#2d6a4f] text-white flex flex-col items-center justify-center gap-1 active:scale-[0.98] mx-1"
            aria-label="Add Job or Quote"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span className="text-[11px] leading-tight">Add / Quote</span>
          </button>
        </div>
      </nav>

      {actionsOpen ? (
        <div
          className="fixed inset-0 z-[45] pointer-events-auto"
          onClick={() => setActionsOpen(false)}
          aria-hidden="true"
        >
          <div
            className="absolute left-0 right-0 bottom-[84px] max-w-md mx-auto px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl border border-zinc-200 bg-white/95 backdrop-blur shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={openAddJob}
                className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold bg-white active:scale-[0.99] border-b border-zinc-200"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                Add Job
              </button>
              <button
                type="button"
                onClick={openQuote}
                className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold bg-white active:scale-[0.99]"
              >
                <span className="text-xl font-bold leading-none text-[#2d6a4f]">£</span>
                Quote
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

