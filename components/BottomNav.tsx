"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
};

const ICON = "h-[22px] w-[22px] shrink-0";
const LABEL = "text-[11px] leading-tight tracking-tight text-center max-w-full truncate px-0.5";

const SCALE_NEAREST = 1.4;
const SCALE_ADJACENT = 1.15;
const MOVE_THRESHOLD_PX = 10;

function scalesForNearest(nearest: number): number[] {
  return [0, 1, 2, 3, 4].map((i) => {
    if (i === nearest) return SCALE_NEAREST;
    if (Math.abs(i - nearest) === 1) return SCALE_ADJACENT;
    return 1;
  });
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsClosing, setActionsClosing] = useState(false);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([null, null, null, null, null]);
  const touchMovedRef = useRef(false);
  const touchStartXRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [dockScales, setDockScales] = useState([1, 1, 1, 1, 1]);

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
          <span className={`${ICON} inline-flex items-center justify-center text-[22px] font-bold leading-none`}>£</span>
        ),
      },
    ];
  }, [pathname]);

  const findNearestIndex = useCallback((clientX: number) => {
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < 5; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const d = Math.abs(clientX - cx);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return nearest;
  }, []);

  const updateDockFromX = useCallback(
    (clientX: number) => {
      const nearest = findNearestIndex(clientX);
      setDockScales(scalesForNearest(nearest));
    },
    [findNearestIndex]
  );

  const resetDockScales = useCallback(() => {
    setDockScales([1, 1, 1, 1, 1]);
  }, []);

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

  const handleNavTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchStartXRef.current = t.clientX;
      touchMovedRef.current = false;
      updateDockFromX(t.clientX);
    },
    [updateDockFromX]
  );

  const handleNavTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - touchStartXRef.current) > MOVE_THRESHOLD_PX) {
        touchMovedRef.current = true;
      }
      updateDockFromX(t.clientX);
    },
    [updateDockFromX]
  );

  const handleNavTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      resetDockScales();
      if (touchMovedRef.current && t) {
        e.preventDefault();
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 400);
        const idx = findNearestIndex(t.clientX);
        if (idx === 4) {
          setActionsOpen(true);
        } else if (idx >= 0 && idx < items.length) {
          router.push(items[idx].href);
        }
      }
      touchMovedRef.current = false;
    },
    [findNearestIndex, items, resetDockScales, router]
  );

  const handleNavMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updateDockFromX(e.clientX);
    },
    [updateDockFromX]
  );

  const handleNavMouseLeave = useCallback(() => {
    resetDockScales();
  }, [resetDockScales]);

  const pillTransition = "transition-[transform] duration-150 ease-out";

  const activePill = "bg-[#1e293b] text-white px-3 py-1.5";
  const inactivePill = "bg-transparent text-[var(--color-text-subtle)] px-2 py-1.5";

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] touch-none"
        onTouchStart={handleNavTouchStart}
        onTouchMove={handleNavTouchMove}
        onTouchEnd={handleNavTouchEnd}
        onTouchCancel={resetDockScales}
        onMouseMove={handleNavMouseMove}
        onMouseLeave={handleNavMouseLeave}
      >
        <div className="mx-auto flex h-16 w-full max-w-full flex-nowrap items-end justify-between gap-0 overflow-visible px-1 md:max-w-md">
          {items.map((item, index) => (
            <button
              key={item.href}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              onClick={() => {
                if (suppressClickRef.current) return;
                router.push(item.href);
              }}
              className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center justify-end touch-manipulation pb-0.5"
              aria-label={item.label}
              aria-current={item.isActive ? "page" : undefined}
            >
              <span
                className={pillTransition}
                style={{
                  transform: `scale(${dockScales[index]})`,
                  transformOrigin: "bottom center",
                }}
              >
                <span
                  className={[
                    "inline-flex max-w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] transition-colors duration-200 ease-out",
                    item.isActive ? activePill : inactivePill,
                  ].join(" ")}
                >
                  <span className={item.isActive ? "text-white" : "text-[var(--color-text-subtle)]"}>{item.icon}</span>
                  <span
                    className={[LABEL, item.isActive ? "font-semibold text-white" : "font-medium text-[var(--color-text-subtle)]"].join(" ")}
                  >
                    {item.label}
                  </span>
                </span>
              </span>
            </button>
          ))}

          <button
            ref={(el) => {
              itemRefs.current[4] = el;
            }}
            type="button"
            onClick={() => {
              if (suppressClickRef.current) return;
              if (actionsOpen) closeActionsMenu();
              else setActionsOpen(true);
            }}
            className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center justify-end touch-manipulation pb-0.5"
            aria-label="Add Job or Quote"
            aria-expanded={actionsOpen}
          >
            <span
              className={pillTransition}
              style={{
                transform: `scale(${dockScales[4]})`,
                transformOrigin: "bottom center",
              }}
            >
              <span className="inline-flex items-center justify-center rounded-[20px] bg-[#1e293b] px-3 py-1.5 text-white shadow-[var(--shadow-sm)]">
                <span className="font-sans text-[22px] font-bold leading-none text-white">+</span>
              </span>
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
