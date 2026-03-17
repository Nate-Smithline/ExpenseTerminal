"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

const mainNav = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/data-sources", label: "Accounts", icon: "database" },
  { href: "/inbox", label: "Inbox", icon: "visibility" },
  { href: "/tax-details", label: "Tax Details", icon: "receipt_long" },
  { href: "/other-deductions", label: "Other Deductions", icon: "savings" },
];

const bottomNav = [
  { href: "/activity", label: "All Activity", icon: "history" },
  { href: "/preferences/automations", label: "Preferences", icon: "tune" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const loadInboxCount = () => {
    // Count pending across all tax years so sync'd transactions show up regardless of date
    fetch(`/api/transactions?status=pending&count_only=true`)
      .then((r) => r.json())
      .then((d) => setInboxCount(d.count ?? 0))
      .catch(() => {});
  };

  useEffect(() => {
    loadInboxCount();
  }, [pathname]);

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
  }, []);

  return (
    <aside className="sticky top-0 h-screen w-[260px] shrink-0 bg-white flex flex-col">
      {/* Small XT logo header */}
      <div className="pl-8 pr-5 pt-6 pb-4">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/xt-logo-v2.png"
            alt="XT"
            width={80}
            height={32}
            className="h-8 w-auto object-contain"
            priority={false}
          />
        </Link>
      </div>

      {/* Main nav - block extends to left edge; content stays aligned (pl-8 = 5+3) */}
      <nav className="flex-1 pl-0 pr-5 space-y-1">
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-none pl-8 pr-3 py-2 text-[13px] font-medium transition-all ${
              isActive(item.href)
                ? "text-sovereign-blue bg-sovereign-blue/10"
                : "text-mono-medium hover:text-mono-dark hover:bg-sovereign-blue/10"
            }`}
          >
            <span
              className={`material-symbols-rounded leading-none transition-colors ${
                isActive(item.href) ? "text-sovereign-blue" : ""
              }`}
              style={{
                fontSize: 20,
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
              }}
            >
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
