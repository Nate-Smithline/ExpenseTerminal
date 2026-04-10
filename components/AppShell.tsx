"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { SidebarPagesPanel } from "./SidebarPagesPanel";
import { UpgradeModalProvider } from "./UpgradeModalContext";
import { SIDEBAR_BOTTOM_NAV, SIDEBAR_MAIN_NAV } from "@/lib/nav/sidebar-main-nav";

const AUTH_ROUTES = ["/login", "/signup", "/auth", "/terms", "/privacy", "/cookies"];
const FULL_WIDTH_ROUTES = ["/", "/pricing", "/request-demo"];

const PREFERENCES_HREF = SIDEBAR_BOTTOM_NAV[0]?.href ?? "/preferences/org";

/** Mobile tab bar: Home, Accounts, Rules — pages, favorites, and preferences live in the menu sheet. */
const mobileFooterNav = [...SIDEBAR_MAIN_NAV];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  const isAuthPage = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isFullWidth = FULL_WIDTH_ROUTES.includes(pathname);
  /** Saved activity pages: use full main column width (not max-w-[880px]) so headers span beside the sidebar. */
  const isSavedPageRoute = pathname.startsWith("/pages/");
  /** Accounts: same full-width shell as saved pages (top bar + content padding inside client). */
  const isAccountsRoute = pathname === "/data-sources";
  /** Public read-only published page — no app chrome */
  const isPublishedPublicRoute = pathname.startsWith("/p/");
  /** Home dashboard: wider column for Notion-style layout */
  const isDashboardRoute = pathname === "/dashboard";

  const isFooterNavActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const menuHighlightsPagesOrPrefs =
    pathname.startsWith("/pages/") || pathname.startsWith("/preferences");

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

  if (isAuthPage || isFullWidth || isPublishedPublicRoute) {
    return <>{children}</>;
  }

  return (
    <UpgradeModalProvider>
      <div className="min-h-screen flex bg-white">
        <aside className="hidden md:block sticky top-0 h-screen shrink-0">
          <Sidebar />
        </aside>

        <main
          className={
            isSavedPageRoute || isAccountsRoute
              ? "flex-1 min-h-0 min-w-0 overflow-y-auto pb-24 md:pb-14"
              : "flex-1 overflow-y-auto px-5 py-8 md:px-8 md:py-14 pb-24 md:pb-14"
          }
        >
          {isSavedPageRoute || isAccountsRoute ? (
            <div className="w-full min-w-0">{children}</div>
          ) : (
            <div
              className={
                isDashboardRoute ? "max-w-6xl mx-auto w-full" : "max-w-[880px] mx-auto"
              }
            >
              {children}
            </div>
          )}
        </main>

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
                  isFooterNavActive(item.href)
                    ? "text-sovereign-blue"
                    : "text-mono-medium active:text-mono-dark"
                }`}
              >
                <span className="material-symbols-rounded text-[22px] leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={mobileMenuOpen ? () => closeMenu() : openMenu}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 rounded-lg transition-colors duration-200 active:text-mono-dark ${
                mobileMenuOpen
                  ? "text-mono-dark"
                  : menuHighlightsPagesOrPrefs
                    ? "text-sovereign-blue"
                    : "text-mono-medium"
              }`}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
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

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-[110] md:hidden flex items-end"
            role="dialog"
            aria-modal="true"
            aria-label="Pages and menu"
          >
            <div
              className={`absolute inset-0 bg-mono-dark/20 transition-opacity duration-300 ${
                isClosing ? "opacity-0" : "opacity-100"
              }`}
              onClick={() => closeMenu()}
              aria-hidden
            />

            <div
              className={`relative w-full mx-auto bg-white shadow-2xl border border-[#F0F1F7] flex flex-col ${
                isEntering ? "translate-y-2 opacity-0" : isClosing ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"
              } transition-all duration-300`}
              style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "78vh" }}
            >
              <div className="px-5 pt-2 pb-1 shrink-0">
                <div className="w-10 h-1 bg-black/15 mx-auto" />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-2">
                <SidebarPagesPanel layout="mobile" onPageLinkClick={() => closeMenu()} />
              </div>

              <div className="shrink-0 border-t border-bg-tertiary/50 px-4 py-3">
                <Link
                  href={PREFERENCES_HREF}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                    e.preventDefault();
                    closeMenu();
                    router.push(PREFERENCES_HREF);
                  }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors touch-manipulation ${
                    pathname.startsWith("/preferences")
                      ? "text-sovereign-blue bg-sovereign-blue/8"
                      : "text-mono-medium hover:text-mono-dark hover:bg-mono-dark/[0.04]"
                  }`}
                >
                  <span
                    className="material-symbols-rounded leading-none text-[22px]"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    tune
                  </span>
                  <span>Preferences</span>
                </Link>
              </div>

              <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] shrink-0">
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
