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
        href: "/jobs",
        label: "Jobs",
        isActive: atJobs,
        icon: (
          <IconBox>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
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
            <span className="text-lg font-bold leading-none">£</span>
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

  const inactive = "text-[var(--color-text-subtle)]";
  const active = "text-white";

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 pb-[env(safe-area-inset-bottom)] min-h-16">
        <div className="w-full max-w-full md:max-w-md mx-auto flex items-stretch justify-between h-16 gap-1">
          {items.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={[
                "flex-1 flex items-center justify-center relative",
                item.isActive ? `${active} font-semibold` : `${inactive} font-medium`,
                "active:scale-[0.98]",
              ].join(" ")}
              aria-label={item.label}
              aria-current={item.isActive ? "page" : undefined}
            >
              <span
                className={[
                  "inline-flex items-center justify-center gap-1.5 rounded-[20px] transition-all duration-200 ease-out px-4 py-1.5",
                  item.isActive ? "bg-[#1e293b] text-white shadow-[var(--shadow-sm)]" : "bg-transparent",
                ].join(" ")}
              >
                <span className={["transition-colors duration-200", item.isActive ? active : inactive].join(" ")}>
                  {item.icon}
                </span>
                <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => (actionsOpen ? closeActionsMenu() : setActionsOpen(true))}
            className="flex-[1.15] flex flex-col items-center justify-center gap-1 bg-[var(--color-primary)] text-white rounded-[14px] mx-0.5 my-1.5 px-3 btn-primary-interactive min-h-[48px] shadow-[var(--shadow-sm)]"
            aria-label="Add Job or Quote"
            aria-expanded={actionsOpen}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span className="text-[11px] leading-tight font-semibold">Add / Quote</span>
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
