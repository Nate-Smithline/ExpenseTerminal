"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LegalBackLinkProps {
  href: string;
  label?: string;
}

export function LegalBackLink({ href, label = "Back" }: LegalBackLinkProps) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        e.preventDefault();
        router.push(href);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [href, router]);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm text-mono-medium hover:text-accent-navy transition-colors mb-8"
    >
      <span className="kbd-hint hidden md:inline-flex">Esc</span>
      <span>{label}</span>
    </Link>
  );
}

