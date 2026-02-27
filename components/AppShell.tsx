"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";

const AUTH_ROUTES = ["/login", "/signup", "/auth", "/terms", "/privacy", "/cookies"];
const FULL_WIDTH_ROUTES = ["/", "/pricing"];

const mobileFooterNav = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/data-sources", label: "Sources", icon: "database" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/tax-details", label: "Tax", icon: "receipt_long" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  const isAuthPage = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isFullWidth = FULL_WIDTH_ROUTES.includes(pathname);

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

  if (isAuthPage || isFullWidth) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-bg-secondary">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:block sticky top-0 h-screen shrink-0">
        <Sidebar />
      </aside>

      {/* Main content — extra bottom padding on mobile for footer */}
      <main className="flex-1 overflow-y-auto px-5 py-8 md:px-14 md:py-14 pb-24 md:pb-14">
        <div className="max-w-[880px] mx-auto">{children}</div>
      </main>

      {/* Mobile footer nav — stays underneath overlay when sidebar is open */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-sm border-t border-bg-tertiary/50 pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary navigation"
      >
        <nav className="flex items-center justify-around h-16 px-2">
          {mobileFooterNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 rounded-lg transition-colors duration-200 ${
                isActive(item.href)
                  ? "text-accent-terracotta"
                  : "text-mono-medium active:text-mono-dark"
              }`}
            >
              <span className="material-symbols-rounded text-[22px] leading-none">
                {item.icon}
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

      {/* Mobile drawer overlay — smooth slide from left, Aesop-style */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop — soft fade */}
          <div
            className={`absolute inset-0 bg-mono-dark/20 drawer-backdrop ${
              isClosing ? "opacity-0" : "opacity-100"
            }`}
            onClick={closeMenu}
            onKeyDown={(e) => e.key === "Escape" && closeMenu()}
            aria-hidden
          />
          {/* Panel — slide from left */}
          <div
            className={`relative w-[260px] max-w-[85vw] h-full bg-bg-secondary shadow-xl flex flex-col drawer-panel ${
              isEntering ? "drawer-panel--entering" : isClosing ? "-translate-x-full" : "translate-x-0"
            }`}
          >
            <button
              type="button"
              onClick={closeMenu}
              className="absolute top-5 right-4 z-10 p-2 rounded-lg text-mono-medium hover:bg-bg-tertiary/40 transition-colors duration-200"
              aria-label="Close menu"
            >
              <span className="material-symbols-rounded text-[24px]">keyboard_double_arrow_left</span>
            </button>
            <div className="flex-1 overflow-y-auto min-h-0">
              <Sidebar />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
