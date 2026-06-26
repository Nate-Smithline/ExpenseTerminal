"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import { UpgradeModalProvider } from "./UpgradeModalContext";
import { TrialBanner } from "./TrialBanner";
import { UpgradeGate } from "./UpgradeGate";

const NO_SHELL_ROUTES = [
  "/login",
  "/signup",
  "/auth",
  "/terms",
  "/privacy",
  "/cookies",
  "/",
  "/pricing",
  "/request-demo",
  "/brand",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const prevPathname = useRef(pathname);

  const noShell = NO_SHELL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const closeNav = useCallback(() => setNavOpen(false), []);
  const openNav = useCallback(() => setNavOpen(true), []);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    if (!navOpen) return;
    const timer = window.setTimeout(closeNav, 0);
    return () => window.clearTimeout(timer);
  }, [closeNav, navOpen, pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && navOpen) closeNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen, closeNav]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  useEffect(() => {
    if (noShell || pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return;
    let cancelled = false;
    fetch("/api/onboarding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (!d.completed) router.replace("/onboarding");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [noShell, pathname, router]);

  if (noShell) {
    return <>{children}</>;
  }

  return (
    <UpgradeModalProvider>
      <div className="app">
        <div className="app__sidebar">
          <Sidebar />
        </div>

        <div className="app__column">
          <header className="app__topbar">
            <div className="app__topbar-brand">
              <span className="app__topbar-mark" aria-hidden>
                XT
              </span>
              <span>Expense Terminal</span>
            </div>
            <button
              type="button"
              className="app__menu-btn"
              onClick={navOpen ? closeNav : openNav}
              aria-label={navOpen ? "Close menu" : "Open menu"}
              aria-expanded={navOpen}
            >
              <span
                className={`hamburger-icon ${navOpen ? "hamburger-icon--open" : ""}`}
                aria-hidden
              >
                <span />
                <span />
                <span />
              </span>
            </button>
          </header>

          <main className="app__main">
            <TrialBanner />
            <UpgradeGate>{children}</UpgradeGate>
          </main>
        </div>

        {navOpen && (
          <div
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <button
              type="button"
              className="nav-drawer__backdrop"
              onClick={closeNav}
              aria-label="Close menu"
            />
            <div className="nav-drawer__panel">
              <Sidebar onNavigate={closeNav} />
            </div>
          </div>
        )}
      </div>
    </UpgradeModalProvider>
  );
}
