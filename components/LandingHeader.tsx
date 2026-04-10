"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const SHOW_PRICING_LINK = false;

type NavLink = { href: string; label: string; primary?: true };

const NAV_LINKS: NavLink[] = [
  ...(SHOW_PRICING_LINK ? [{ href: "/pricing", label: "Pricing" } satisfies NavLink] : []),
  { href: "/request-demo", label: "Request Demo" },
  { href: "/login", label: "Login" },
  { href: "/signup", label: "Try Free", primary: true },
];

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
      <nav className="flex items-center justify-between px-4 md:px-16 py-3 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-black/10">
        <Link
          href="/"
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-black/10 rounded-xl"
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
                className="inline-flex items-center justify-center bg-[#007aff] px-5 py-2.5 text-sm font-medium text-white rounded-full transition-all hover:bg-[#0066d6] hover:shadow-md active:scale-[0.99]"
              >
                {item.label}
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-black/80 hover:text-black transition-colors px-3 py-2 rounded-lg hover:bg-black/5"
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
              className="inline-flex items-center justify-center bg-[#007aff] px-4 py-2 text-sm font-medium text-white rounded-full transition-all hover:bg-[#0066d6] hover:shadow-md active:scale-[0.99]"
            >
              {item.label}
            </Link>
          ))}

        {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={mobileMenuOpen ? closeMenu : openMenu}
            className="md:hidden p-2 rounded-xl text-black hover:bg-black/5 transition-colors"
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
            className={`relative w-[280px] max-w-[85vw] h-full bg-[#F5F5F7] shadow-xl flex flex-col drawer-panel ${
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
                      ? "mx-4 mt-2 inline-flex items-center justify-center bg-[#007aff] px-5 py-2.5 text-base font-medium text-white rounded-full transition-all hover:bg-[#0066d6] hover:shadow-md active:scale-[0.99] text-center"
                      : "mx-2 px-4 py-3 text-base text-black/85 hover:bg-black/5 transition-colors rounded-xl"
                  }
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={closeMenu}
                className="mt-4 mx-4 inline-flex items-center justify-center px-5 py-2.5 text-base font-medium text-black bg-white border border-black/10 rounded-full text-center hover:bg-black/5 transition-colors"
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
