"use client";

import { useMemo } from "react";
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
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </IconBox>
        ),
      },
    ];
  }, [pathname]);

  function openAddJob() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("add_job", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
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
          onClick={openAddJob}
          className="flex-1 py-3 rounded-xl bg-[#2d6a4f] text-white flex flex-col items-center justify-center gap-1 active:scale-[0.98] mx-1"
          aria-label="Add Job"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          <span className="text-[11px] leading-tight">Add Job</span>
        </button>
      </div>
    </nav>
  );
}

