"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

const mainNav = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/data-sources", label: "Accounts", icon: "database" },
  { href: "/inbox", label: "Inbox", icon: "visibility" },
  { href: "/tax-details", label: "Tax Details", icon: "receipt_long" },
];

const bottomNav = [
  { href: "/activity", label: "All Activity", icon: "history" },
  { href: "/rules", label: "Rules & Notifications", icon: "tune" },
  { href: "/other-deductions", label: "Other Deductions", icon: "calculate" },
];

function getGreeting(profile: { name_prefix?: string | null; first_name?: string | null; last_name?: string | null } | null): string {
  if (!profile) return "Hi";
  const { name_prefix, first_name, last_name } = profile;
  const prefix = (name_prefix ?? "").trim();
  const first = (first_name ?? "").trim();
  const last = (last_name ?? "").trim();
  if (prefix && last) return `Hi ${prefix} ${last}`;
  if (prefix && first) return `Hi ${prefix} ${first}`;
  if (prefix) return `Hi ${prefix}`;
  if (first) return `Hi ${first}`;
  if (last) return `Hi ${last}`;
  return "Hi";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [profile, setProfile] = useState<{ name_prefix?: string | null; first_name?: string | null; last_name?: string | null } | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const greeting = getGreeting(profile);

  const loadProfile = useCallback(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((body) => setProfile(body?.data ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    function handleProfileUpdated(e: Event) {
      const ev = e as CustomEvent<{ name_prefix?: string | null; first_name?: string | null; last_name?: string | null }>;
      if (ev.detail) {
        setProfile((prev) => ({ ...(prev ?? {}), ...ev.detail }));
      } else {
        loadProfile();
      }
    }
    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => window.removeEventListener("profile-updated", handleProfileUpdated);
  }, [loadProfile]);

  const loadInboxCount = useCallback(() => {
    // Count pending across all tax years so sync'd transactions show up regardless of date
    fetch(`/api/transactions?status=pending&count_only=true`)
      .then((r) => r.json())
      .then((d) => setInboxCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadInboxCount();
  }, [pathname, loadInboxCount]);

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPlan(d?.plan ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleInboxChanged() {
      loadInboxCount();
    }
    window.addEventListener("inbox-count-changed", handleInboxChanged);
    return () => window.removeEventListener("inbox-count-changed", handleInboxChanged);
  }, [loadInboxCount]);

  const closeProfile = useCallback(() => {
    setIsClosing(true);
    const t = setTimeout(() => {
      setProfileOpen(false);
      setIsClosing(false);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeProfile();
      }
    }
    if (profileOpen && !isClosing) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [profileOpen, isClosing, closeProfile]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeProfile();
    }
    if (profileOpen && !isClosing) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [profileOpen, isClosing, closeProfile]);

  /* After mounting with opacity:0, wait for a painted frame then transition to open (fade-in) */
  useEffect(() => {
    if (!profileOpen || !isEntering || isClosing) return;
    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setIsEntering(false));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
    };
  }, [profileOpen, isEntering, isClosing]);

  const handleLogout = useCallback(async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <aside className="sticky top-0 h-screen w-[260px] shrink-0 bg-white flex flex-col">
      {/* Profile dropdown — same width as main nav (pl-0 pr-5); gap below before Home */}
      <div className="pl-0 pr-5 pt-6 pb-4 relative" ref={dropdownRef}>
        <button
          onClick={() => {
            if (profileOpen) {
              closeProfile();
            } else {
              setIsEntering(true);
              setProfileOpen(true);
              loadProfile();
            }
          }}
          className={`w-full text-left rounded-none py-2 pl-8 pr-2 transition-all ${
            profileOpen
              ? "text-sovereign-blue bg-sovereign-blue/10"
              : "text-mono-dark hover:text-mono-dark hover:bg-sovereign-blue/10"
          }`}
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="font-sans text-lg tracking-tight truncate">
              {greeting}
            </span>
            <span className={`material-symbols-rounded text-[18px] font-light shrink-0 ${profileOpen ? "text-sovereign-blue" : "text-black"}`}>
              {profileOpen ? "expand_less" : "expand_more"}
            </span>
          </div>
        </button>

        {(profileOpen || isClosing) && (
          <div
            className={`profile-dropdown-panel absolute left-0 right-5 top-full bg-white rounded-none shadow-lg border border-bg-tertiary/40 border-t-0 py-1.5 z-50 ${
              isClosing ? "profile-dropdown-panel--closing" : isEntering ? "profile-dropdown-panel--entering" : "profile-dropdown-panel--open"
            }`}
          >
            <Link
              href="/profile"
              onClick={() => closeProfile()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-base text-mono-medium hover:bg-sovereign-blue/10 hover:text-mono-dark transition-colors"
            >
              <span className="material-symbols-rounded shrink-0" style={{ fontSize: 18 }}>person</span>
              Profile Settings
            </Link>
            <Link
              href="/org-profile"
              onClick={() => closeProfile()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-base text-mono-medium hover:bg-sovereign-blue/10 hover:text-mono-dark transition-colors"
            >
              <span className="material-symbols-rounded shrink-0" style={{ fontSize: 18 }}>business</span>
              Org Profile
            </Link>
            <Link
              href="/settings/billing"
              onClick={() => closeProfile()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-base text-mono-medium hover:bg-sovereign-blue/10 hover:text-mono-dark transition-colors"
            >
              <span className="material-symbols-rounded shrink-0" style={{ fontSize: 18 }}>credit_card</span>
              Billing
            </Link>
            <div className="border-t border-bg-tertiary/30 my-1" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-base text-mono-medium hover:bg-sovereign-blue/10 hover:text-mono-dark transition-colors text-left"
            >
              <span className="material-symbols-rounded shrink-0" style={{ fontSize: 18 }}>logout</span>
              Log Out
            </button>
          </div>
        )}
      </div>

      {/* Main nav - block extends to left edge; content stays aligned (pl-8 = 5+3) */}
      <nav className="flex-1 pl-0 pr-5 space-y-1">
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-none pl-8 pr-3 py-3 text-[14px] font-medium transition-all ${
              isActive(item.href)
                ? "text-sovereign-blue bg-sovereign-blue/10"
                : "text-mono-medium hover:text-mono-dark hover:bg-sovereign-blue/10"
            }`}
          >
            <span className={`material-symbols-rounded text-[22px] leading-none transition-colors ${
              isActive(item.href) ? "text-sovereign-blue" : ""
            }`}>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.href === "/inbox" && inboxCount != null && inboxCount > 0 && (
              <span className="bg-[#8A9BB0] text-black text-[11px] font-semibold rounded-none px-2 py-0.5 tabular-nums">
                {inboxCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Bottom nav - left align with main nav (px-5) */}
      <div className="px-5 pb-3 space-y-0.5">
        {plan === "free" && (
          <div className="rounded-lg border border-bg-tertiary/60 bg-white/80 p-3 mb-3">
            <p className="font-semibold text-mono-dark text-sm">Upgrade to Pro — $400/year</p>
            <p className="text-xs text-mono-light mt-1 leading-snug">
              Unlock bank connections and full history.
            </p>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/billing/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan: "plus" }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.url) window.location.href = data.url;
              }}
              className="mt-2 w-full rounded-md bg-mono-dark px-3 py-2 text-xs font-semibold text-white hover:bg-mono-dark/90 transition text-center"
            >
              Upgrade to Pro
            </button>
          </div>
        )}
        {bottomNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center py-2.5 text-base transition-all group ${
              isActive(item.href)
                ? "text-sovereign-blue font-medium"
                : "text-mono-light hover:text-mono-medium"
            }`}
          >
            {/* Line that grows 0→20px and pushes the text right */}
            <span
              className={`shrink-0 overflow-hidden flex items-center transition-all duration-500 ${
                isActive(item.href) ? "w-[20px]" : "w-0 group-hover:w-[20px]"
              }`}
            >
              <span className="h-0.5 w-[20px] rounded-full bg-sovereign-blue" />
            </span>
            <span className="ml-2">{item.label}</span>
          </Link>
        ))}
        <a
          href="mailto:expenseterminal@outlook.com"
          className="flex items-center py-2.5 text-base transition-all group text-mono-light hover:text-mono-medium"
        >
          <span className="shrink-0 overflow-hidden flex items-center transition-all duration-500 w-0 group-hover:w-[20px]">
            <span className="h-0.5 w-[20px] rounded-full bg-sovereign-blue" />
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
