"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
};

const ICON = "h-[22px] w-[22px] shrink-0";
const LABEL_ACTIVE = "text-[10px] font-medium leading-none text-white";
const LABEL_INACTIVE = "text-[10px] font-medium leading-none text-[rgba(255,255,255,0.4)]";
const INACTIVE = "text-[rgba(255,255,255,0.4)]";
const ACTIVE = "text-white";

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
          <span className={`${ICON} inline-flex items-center justify-center text-[18px] font-bold leading-none`}>£</span>
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

  const sheetBottomClass = "bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px))]";

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex flex-col border-t border-[rgba(255,255,255,0.08)] bg-[#1e293b] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(0,0,0,0.2)]"
        style={{ boxSizing: "border-box" }}
        aria-label="Main navigation"
      >
        <div className="flex h-[65px] w-full min-w-0 flex-row items-center">
          {items.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] touch-manipulation active:opacity-90"
              aria-label={item.label}
              aria-current={item.isActive ? "page" : undefined}
            >
              <span className="flex h-[3px] w-full shrink-0 items-center justify-center" aria-hidden>
                {item.isActive ? <span className="h-[3px] w-5 shrink-0 rounded-full bg-white" /> : null}
              </span>
              <span className={item.isActive ? ACTIVE : INACTIVE}>{item.icon}</span>
              <span className={item.isActive ? LABEL_ACTIVE : LABEL_INACTIVE}>{item.label}</span>
            </button>
          ))}

          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => (actionsOpen ? closeActionsMenu() : setActionsOpen(true))}
              className="flex h-11 w-11 shrink-0 items-center justify-center touch-manipulation active:opacity-90"
              aria-label="Add Job or Quote"
              aria-expanded={actionsOpen}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.15)] text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </span>
            </button>
          </div>
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
            className={["absolute left-0 right-0 w-full max-w-full md:max-w-md mx-auto px-2", sheetBottomClass].join(" ")}
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
