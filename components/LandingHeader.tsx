"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/request-demo", label: "Request Demo" },
  { href: "/login", label: "Login" },
  { href: "/signup", label: "Try Free", primary: true },
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
      <nav className="flex items-center justify-between px-4 md:px-16 py-3 bg-[#5B82B4]">
        <Link
          href="/"
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent-sage/50 rounded"
        >
          <Image
            src="/xt-logo-v2.png"
            alt="XT"
            width={168}
            height={60}
            className="h-12 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop: inline links */}
        <div className="hidden md:flex items-center gap-2 sm:gap-3">
          {NAV_LINKS.map((item) =>
            "primary" in item && item.primary ? (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center justify-center bg-black px-5 py-2.5 text-sm font-medium text-white rounded-none transition-colors hover:opacity-70"
              >
                {item.label}
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-base text-white/90 hover:text-white transition-colors px-4 py-2"
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Mobile: primary CTA always visible */}
        <div className="flex items-center gap-3 md:hidden">
          {NAV_LINKS.filter((item) => "primary" in item && item.primary).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white rounded-none transition-colors hover:opacity-70"
            >
              {item.label}
            </Link>
          ))}

        {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={mobileMenuOpen ? closeMenu : openMenu}
            className="md:hidden p-2 rounded-lg text-black hover:bg-white/10 transition-colors"
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
        </div>
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
            className={`relative w-[260px] max-w-[85vw] h-full bg-[#5B82B4] shadow-xl flex flex-col drawer-panel ${
              isEntering ? "drawer-panel--entering" : isClosing ? "-translate-x-full" : "translate-x-0"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-5">
              <Link href="/" onClick={closeMenu} className="flex items-center">
                <Image
                  src="/mobile-logo.png"
                  alt="XT"
                  width={100}
                  height={36}
                  className="h-7 w-auto object-contain"
                />
              </Link>
            </div>
            <nav className="flex flex-col py-4">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={
                    "primary" in item && item.primary
                      ? "mx-4 mt-2 inline-flex items-center justify-center bg-black px-5 py-2.5 text-base font-medium text-white rounded-none transition-colors hover:opacity-70 text-center"
                      : "px-4 py-3 text-base text-black hover:bg-white/10 transition-colors"
                  }
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={closeMenu}
                className="mt-4 mx-4 inline-flex items-center justify-center px-5 py-2.5 text-base font-medium text-black bg-transparent border border-black text-center"
              >
                Close
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
