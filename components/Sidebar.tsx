"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getStickyTaxYearClient } from "@/lib/tax-year-cookie";

const GUIDES_URL = "https://www.notion.so/guides";

const mainNav = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/data-sources", label: "Data Sources", icon: "database" },
  { href: "/inbox", label: "Inbox", icon: "visibility" },
  { href: "/tax-details", label: "Tax Details", icon: "receipt_long" },
];

const bottomNav = [
  { href: "/activity", label: "All Activity", icon: "history" },
  { href: "/org-profile", label: "Org Profile", icon: "settings" },
  { href: "/other-deductions", label: "Other Deductions", icon: "calculate" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const loadInboxCount = useCallback(() => {
    const year = getStickyTaxYearClient();
    fetch(`/api/transactions?tax_year=${year}&status=pending&transaction_type=expense&count_only=true`)
      .then((r) => r.json())
      .then((d) => setInboxCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadInboxCount();
  }, [pathname, loadInboxCount]);

  useEffect(() => {
    function handleInboxChanged() {
      loadInboxCount();
    }
    window.addEventListener("inbox-count-changed", handleInboxChanged);
    return () => window.removeEventListener("inbox-count-changed", handleInboxChanged);
  }, [loadInboxCount]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [profileOpen]);

  const handleLogout = useCallback(async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <aside className="sticky top-0 h-screen w-[260px] shrink-0 bg-bg-secondary flex flex-col">
      {/* Profile dropdown */}
      <div className="px-5 pt-6 pb-4 relative" ref={dropdownRef}>
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="flex items-center gap-2.5 w-full text-left hover:opacity-80 transition-opacity"
        >
          <div className="h-9 w-9 rounded-full bg-accent-sage/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-accent-sage">NS</span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-sm font-medium text-mono-dark truncate">Hi Nathan</span>
            <span className="material-symbols-rounded text-[14px] text-mono-light">
              {profileOpen ? "expand_less" : "expand_more"}
            </span>
          </div>
        </button>

        {profileOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg shadow-lg border border-bg-tertiary/40 py-1.5 z-50 animate-in">
            <Link
              href="/profile"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-mono-medium hover:bg-bg-secondary/60 hover:text-mono-dark transition-colors"
            >
              <span className="material-symbols-rounded text-[18px]">person</span>
              Profile Settings
            </Link>
            <Link
              href="/org-profile"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-mono-medium hover:bg-bg-secondary/60 hover:text-mono-dark transition-colors"
            >
              <span className="material-symbols-rounded text-[18px]">business</span>
              Org Profile
            </Link>
            <div className="border-t border-bg-tertiary/30 my-1" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-mono-medium hover:bg-bg-secondary/60 hover:text-mono-dark transition-colors text-left"
            >
              <span className="material-symbols-rounded text-[18px]">logout</span>
              Log Out
            </button>
          </div>
        )}
      </div>

      {/* Main nav - left align with Guides and bottom nav (px-5) */}
      <nav className="flex-1 px-5 space-y-1">
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[14px] font-medium transition-all ${
              isActive(item.href)
                ? "text-accent-terracotta bg-accent-terracotta/10"
                : "text-mono-medium hover:text-mono-dark hover:bg-bg-tertiary/30"
            }`}
          >
            <span className={`material-symbols-rounded text-[22px] leading-none transition-colors ${
              isActive(item.href) ? "text-accent-terracotta" : ""
            }`}>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.href === "/inbox" && inboxCount != null && inboxCount > 0 && (
              <span className="bg-accent-sage/10 text-accent-sage text-[11px] font-semibold rounded-full px-2 py-0.5 tabular-nums">
                {inboxCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Bottom nav - left align with main nav (px-5) */}
      <div className="px-5 pb-3 space-y-0.5">
        {bottomNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center py-2.5 text-base transition-all group ${
              isActive(item.href)
                ? "text-accent-terracotta font-medium"
                : "text-mono-light hover:text-mono-medium"
            }`}
          >
            {/* Line that grows 0→20px and pushes the text right */}
            <span
              className={`shrink-0 overflow-hidden flex items-center transition-all duration-500 ${
                isActive(item.href) ? "w-[20px]" : "w-0 group-hover:w-[20px]"
              }`}
            >
              <span className="h-0.5 w-[20px] rounded-full bg-accent-terracotta" />
            </span>
            <span className="ml-2">{item.label}</span>
          </Link>
        ))}
        <a
          href="mailto:expenseterminal@outlook.com"
          className="flex items-center py-2.5 text-base transition-all group text-mono-light hover:text-mono-medium"
        >
          <span className="shrink-0 overflow-hidden flex items-center transition-all duration-500 w-0 group-hover:w-[20px]">
            <span className="h-0.5 w-[20px] rounded-full bg-accent-terracotta" />
          </span>
          <span className="ml-2">Contact Our Team</span>
        </a>
      </div>

      {/* Footer - Guides and Support commented out
      <div className="px-5 pb-4 flex items-center gap-3">
        <a
          href={GUIDES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-bg-tertiary/60 text-sm text-mono-medium hover:text-mono-dark hover:border-bg-tertiary transition-all"
        >
          <span className="material-symbols-rounded text-[12px]">menu_book</span> Guides
        </a>
        <a
          href="mailto:expenseterminal@outlook.com"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-bg-tertiary/60 text-sm text-mono-medium hover:text-mono-dark hover:border-bg-tertiary transition-all"
        >
          <span className="material-symbols-rounded text-[12px]">mail</span> Support
        </a>
      </div>
      */}
    </aside>
  );
}
