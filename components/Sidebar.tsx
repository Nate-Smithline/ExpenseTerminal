"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  IBudget,
  ICash,
  ITax,
  IReview,
  IAccounts,
  ISettings,
} from "./ui/icons";

const NAV = [
  { id: "budget",   label: "Budget",    href: "/budget",   Icon: IBudget },
  { id: "cashflow", label: "Cash Flow", href: "/cashflow", Icon: ICash },
  { id: "tax",      label: "Tax",       href: "/tax",      Icon: ITax,     badge: "Q2" },
  { id: "review",   label: "Review",    href: "/review",   Icon: IReview,  badgeCount: true },
  { id: "accounts", label: "Accounts",  href: "/accounts", Icon: IAccounts },
] as const;

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const onSettings = isActive("/settings");

  useEffect(() => {
    fetch("/api/review?count_only=true")
      .then((r) => r.json())
      .then((d) => setReviewCount(d.count ?? 0))
      .catch(() => {});
  }, [pathname]);

  const navClass = ["nav", className].filter(Boolean).join(" ");

  return (
    <aside className={navClass}>
      <div className="nav__brand">
        <div className="nav__brand-mark">XT</div>
      </div>

      <div className="nav__group">
        <div className="nav__list">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.id}
                href={n.href}
                className={`nav__item ${active ? "nav__item--active" : ""}`}
                onClick={onNavigate}
              >
                <n.Icon className="nav__item-icon" size={18} />
                <span>{n.label}</span>

                {"badge" in n && n.badge && !active && (
                  <span className="nav__pill">{n.badge}</span>
                )}

                {"badgeCount" in n &&
                  n.badgeCount &&
                  !active &&
                  reviewCount != null &&
                  reviewCount > 0 && (
                    <span className="nav__pill nav__pill--alert">
                      {reviewCount > 99 ? "99+" : reviewCount}
                    </span>
                  )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="nav__footer">
        <Link
          href="/settings"
          className={`nav__item ${onSettings ? "nav__item--active" : ""}`}
          aria-label="Profile & settings"
          onClick={onNavigate}
        >
          <ISettings size={18} className="nav__item-icon" />
          <span>Profile &amp; settings</span>
        </Link>
      </div>
    </aside>
  );
}
