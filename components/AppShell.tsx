"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { UpgradeModalProvider } from "./UpgradeModalContext";

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
  const [navOpen, setNavOpen] = useState(false);

  const noShell = NO_SHELL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const closeNav = useCallback(() => setNavOpen(false), []);
  const openNav = useCallback(() => setNavOpen(true), []);

  useEffect(() => {
    if (navOpen) closeNav();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- close on route change

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

          <main className="app__main">{children}</main>
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
