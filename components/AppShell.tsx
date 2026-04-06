"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { UpgradeModalProvider } from "./UpgradeModalContext";

const AUTH_ROUTES = ["/login", "/signup", "/auth", "/terms", "/privacy", "/cookies"];
const FULL_WIDTH_ROUTES = ["/", "/pricing", "/request-demo"];

const mobileFooterNav = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/data-sources", label: "Accounts & Data", icon: "database" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/other-deductions", label: "Deductions", icon: "receipt_long" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  const isAuthPage = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isFullWidth = FULL_WIDTH_ROUTES.includes(pathname);
  /** Saved activity pages: use full main column width (not max-w-[880px]) so headers span beside the sidebar. */
  const isSavedPageRoute = pathname.startsWith("/pages/");
  /** Public read-only published page — no app chrome */
  const isPublishedPublicRoute = pathname.startsWith("/p/");

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const openMenu = useCallback(() => {
    setMobileMenuOpen(true);
    setIsEntering(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsClosing(true);
    const t = setTimeout(() => {
      setMobileMenuOpen(false);
      setIsClosing(false);
    }, 320);
    return () => clearTimeout(t);
  }, []);

  // Trigger slide-in: start panel off-screen, then animate to visible
  useEffect(() => {
    if (!mobileMenuOpen || !isEntering) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsEntering(false));
    });
    return () => cancelAnimationFrame(id);
  }, [mobileMenuOpen, isEntering]);

  useEffect(() => {
    if (mobileMenuOpen) closeMenu();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- close on route change only when open

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen, closeMenu]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const loadInboxCount = useCallback(() => {
    fetch(`/api/transactions?status=pending&count_only=true`)
      .then((r) => r.json())
      .then((d) => setInboxCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadInboxCount();
  }, [loadInboxCount, pathname]);

  useEffect(() => {
    function handleInboxChanged() {
      loadInboxCount();
    }
    window.addEventListener("inbox-count-changed", handleInboxChanged);
    return () => window.removeEventListener("inbox-count-changed", handleInboxChanged);
  }, [loadInboxCount]);

  if (isAuthPage || isFullWidth || isPublishedPublicRoute) {
    return <>{children}</>;
  }

  return (
    <UpgradeModalProvider>
    <div className="min-h-screen flex bg-white">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:block sticky top-0 h-screen shrink-0">
        <Sidebar />
      </aside>

      {/* Main content — extra bottom padding on mobile for footer */}
      <main
        className={
          isSavedPageRoute
            ? "flex-1 min-h-0 min-w-0 overflow-y-auto pb-24 md:pb-14"
            : "flex-1 overflow-y-auto px-5 py-8 md:px-8 md:py-14 pb-24 md:pb-14"
        }
      >
        {isSavedPageRoute ? (
          <div className="w-full min-w-0">{children}</div>
        ) : (
          <div className="max-w-[880px] mx-auto">{children}</div>
        )}
      </main>

      {/* Mobile footer nav — stays underneath overlay when sidebar is open */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white/95 backdrop-blur-sm border-t border-bg-tertiary/50 pb-[env(safe-area-inset-bottom)] touch-manipulation"
        aria-label="Primary navigation"
      >
        <nav className="flex items-center justify-around h-16 px-2 relative z-10">
          {mobileFooterNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                e.preventDefault();
                router.push(item.href);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 rounded-lg transition-colors duration-200 touch-manipulation ${
                isActive(item.href)
                  ? "text-sovereign-blue"
                  : "text-mono-medium active:text-mono-dark"
              }`}
            >
              <span className="relative material-symbols-rounded text-[22px] leading-none">
                {item.icon}
                {item.href === "/inbox" && inboxCount != null && inboxCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-[#2563EB]"
                    aria-label="Inbox has items"
                  />
                )}
              </span>
              <span className="text-[10px] font-medium tracking-tight">
                {item.label}
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={mobileMenuOpen ? closeMenu : openMenu}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 rounded-lg text-mono-medium transition-colors duration-200 active:text-mono-dark"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <span
              className={`hamburger-icon ${mobileMenuOpen ? "hamburger-icon--open" : ""}`}
              aria-hidden
            >
              <span />
              <span />
              <span />
            </span>
            <span className="text-[10px] font-medium tracking-tight">Menu</span>
          </button>
        </nav>
      </footer>

      {/* Mobile menu sheet — modal (instead of sidebar drawer) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[110] md:hidden flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className={`absolute inset-0 bg-mono-dark/20 transition-opacity duration-300 ${
              isClosing ? "opacity-0" : "opacity-100"
            }`}
            onClick={closeMenu}
            aria-hidden
          />

          <div
            className={`relative w-full mx-auto bg-white shadow-2xl border border-[#F0F1F7] ${
              isEntering ? "translate-y-2 opacity-0" : isClosing ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"
            } transition-all duration-300`}
            style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "72vh" }}
          >
            <div className="px-5 pt-2 pb-1">
              <div className="w-10 h-1 bg-black/15 mx-auto" />
            </div>

            <nav className="px-5 pt-1 pb-3 space-y-0 overflow-y-auto">
              {[
                { href: "/other-deductions", label: "Other Deductions" },
                { href: "/tax-filing", label: "Tax Filing" },
                { href: "/activity", label: "All Activity" },
                { href: "/preferences/automations", label: "Preferences" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                    e.preventDefault();
                    closeMenu();
                    router.push(item.href);
                  }}
                  className={`flex items-center justify-between py-3 text-base ${
                    isActive(item.href) ? "text-mono-dark" : "text-mono-medium"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <a
                href="mailto:expenseterminal@outlook.com"
                className="w-full h-11 bg-[#E8EEF5] border border-[#F0F1F7] text-mono-dark text-sm font-medium rounded-none inline-flex items-center justify-center"
              >
                Contact Team
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
    </UpgradeModalProvider>
  );
}
