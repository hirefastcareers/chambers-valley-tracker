"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
};

const ICON = "h-5 w-5 shrink-0";
const LABEL = "text-[11px] leading-tight tracking-tight text-center max-w-full truncate px-0.5";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsClosing, setActionsClosing] = useState(false);

  const items = useMemo<NavItem[]>(() => {
    const atDashboard = pathname === "/" || pathname === "/dashboard";
    const atCustomers = pathname.startsWith("/customers");
    const atJobs = pathname === "/jobs";
    const atEarnings = pathname === "/earnings";

    return [
      {
        href: "/",
        label: "Dashboard",
        isActive: atDashboard,
        icon: (
          <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7" />
            <path d="M9 22V12h6v10" />
          </svg>
        ),
      },
      {
        href: "/customers",
        label: "Customers",
        isActive: atCustomers,
        icon: (
          <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <path d="M20 8v6" />
            <path d="M23 11h-6" />
          </svg>
        ),
      },
      {
        href: "/jobs",
        label: "Jobs",
        isActive: atJobs,
        icon: (
          <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        ),
      },
      {
        href: "/earnings",
        label: "Earnings",
        isActive: atEarnings,
        icon: (
          <span className={`${ICON} inline-flex items-center justify-center text-[15px] font-bold leading-none`}>£</span>
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
    setActionsClosing(false);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function openQuote() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("quote", "1");
    params.delete("add_job");
    params.delete("edit_job_id");
    setActionsOpen(false);
    setActionsClosing(false);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function closeActionsMenu() {
    setActionsClosing(true);
    window.setTimeout(() => {
      setActionsOpen(false);
      setActionsClosing(false);
    }, 200);
  }

  const pillBase =
    "inline-flex max-w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] px-3 py-1.5 transition-colors duration-200 ease-out";
  const activePill = "bg-[#1e293b] text-white";
  const inactivePill = "bg-transparent text-[var(--color-text-subtle)]";

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-16 w-full max-w-full flex-nowrap items-center justify-between gap-0 overflow-hidden px-1 md:max-w-md">
          {items.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={[
                "flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center justify-center active:scale-[0.98]",
                "touch-manipulation",
              ].join(" ")}
              aria-label={item.label}
              aria-current={item.isActive ? "page" : undefined}
            >
              <span className={[pillBase, item.isActive ? activePill : inactivePill].join(" ")}>
                <span className={item.isActive ? "text-white" : "text-[var(--color-text-subtle)]"}>{item.icon}</span>
                <span className={[LABEL, item.isActive ? "font-semibold text-white" : "font-medium text-[var(--color-text-subtle)]"].join(" ")}>
                  {item.label}
                </span>
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => (actionsOpen ? closeActionsMenu() : setActionsOpen(true))}
            className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center justify-center touch-manipulation active:scale-[0.98]"
            aria-label="Add Job or Quote"
            aria-expanded={actionsOpen}
          >
            <span className={[pillBase, "bg-[#1e293b] text-white shadow-[var(--shadow-sm)]"].join(" ")}>
              <svg viewBox="0 0 24 24" className={`${ICON} text-white`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              <span className="text-[10px] font-semibold leading-tight text-white min-[380px]:text-[11px]">Add / Quote</span>
            </span>
          </button>
        </div>
      </nav>

      {actionsOpen ? (
        <div
          className={[
            "fixed inset-0 z-[45] pointer-events-auto bg-black/40",
            actionsClosing ? "sheet-backdrop-exit" : "sheet-backdrop-enter",
          ].join(" ")}
          onClick={closeActionsMenu}
          aria-hidden="true"
        >
          <div
            className="absolute left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] w-full max-w-full md:max-w-md mx-auto px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={[
                "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] overflow-hidden",
                actionsClosing ? "sheet-panel-exit" : "sheet-panel-enter",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={openAddJob}
                className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold bg-[var(--color-surface)] active:scale-[0.99] border-b border-[var(--color-border)] text-[var(--color-text)]"
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
                className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold bg-[var(--color-surface)] active:scale-[0.99] text-[var(--color-text)]"
              >
                <span className="text-lg font-bold leading-none text-[var(--color-accent)]">£</span>
                Quote
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
