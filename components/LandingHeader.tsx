"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/request-demo", label: "Request Demo" },
  { href: "/login", label: "Login" },
  { href: "/signup", label: "Get Started", primary: true },
] as const;

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
    setIsClosing(true);
    const t = setTimeout(() => setIsClosing(false), 320);
    return () => clearTimeout(t);
  }, []);

  const openMenu = useCallback(() => {
    setMobileMenuOpen(true);
    setIsEntering(true);
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    if (mobileMenuOpen) closeMenu();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- close on route change

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen, closeMenu]);

  useEffect(() => {
    if (!mobileMenuOpen || !isEntering) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsEntering(false));
    });
    return () => cancelAnimationFrame(id);
  }, [mobileMenuOpen, isEntering]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Top bar: always visible */}
      <nav className="flex items-center justify-between px-4 md:px-16 py-5">
        <Link
          href="/"
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent-sage/50 rounded"
        >
          <Image
            src="/xt-logo.png"
            alt="XT"
            width={60}
            height={24}
            className="h-6 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop: inline links */}
        <div className="hidden md:flex items-center gap-2 sm:gap-3">
          {NAV_LINKS.map((item) =>
            "primary" in item && item.primary ? (
              <Link key={item.href} href={item.href} className="btn-primary text-sm">
                {item.label}
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-mono-medium hover:text-mono-dark transition-colors px-4 py-2"
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={mobileMenuOpen ? closeMenu : openMenu}
          className="md:hidden p-2 rounded-lg text-mono-dark hover:bg-bg-tertiary/50 transition-colors"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <span
            className={`hamburger-icon block ${mobileMenuOpen ? "hamburger-icon--open" : ""}`}
            aria-hidden
          >
            <span />
            <span />
            <span />
          </span>
        </button>
      </nav>

      {/* Mobile drawer — slide in from left */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className={`absolute inset-0 bg-mono-dark/20 drawer-backdrop ${
              isClosing ? "opacity-0" : "opacity-100"
            }`}
            onClick={closeMenu}
            aria-hidden
          />
          <div
            className={`relative w-[260px] max-w-[85vw] h-full bg-bg-secondary shadow-xl flex flex-col drawer-panel ${
              isEntering ? "drawer-panel--entering" : isClosing ? "-translate-x-full" : "translate-x-0"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-5 border-b border-bg-tertiary/40">
              <Link href="/" onClick={closeMenu} className="flex items-center">
                <Image
                  src="/xt-logo.png"
                  alt="XT"
                  width={60}
                  height={24}
                  className="h-6 w-auto object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={closeMenu}
                className="p-2 rounded-lg text-mono-medium hover:bg-bg-tertiary/40 transition-colors"
                aria-label="Close menu"
              >
                <span className="material-symbols-rounded text-[24px]">close</span>
              </button>
            </div>
            <nav className="flex flex-col py-4">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={
                    "primary" in item && item.primary
                      ? "mx-4 mt-2 btn-primary text-sm text-center"
                      : "px-4 py-3 text-sm text-mono-dark hover:bg-bg-tertiary/40 transition-colors"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
