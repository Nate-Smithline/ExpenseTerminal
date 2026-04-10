"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarPagesPanel } from "./SidebarPagesPanel";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import {
  SIDEBAR_BOTTOM_NAV,
  SIDEBAR_EXTERNAL_NAV,
  SIDEBAR_MAIN_NAV,
  type SidebarNavItem,
} from "@/lib/nav/sidebar-main-nav";

const mainNav: SidebarNavItem[] = [...SIDEBAR_MAIN_NAV, ...SIDEBAR_EXTERNAL_NAV];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const navLink = (item: SidebarNavItem) => {
    const active = !item.external && isActive(item.href);
    const className = `flex items-center gap-2 ml-5 mr-2 rounded-md pl-3 pr-2 py-1.5 text-[13px] font-medium transition-colors ${
      active
        ? "text-mono-dark bg-mono-dark/[0.06]"
        : "text-mono-medium hover:text-mono-dark hover:bg-mono-dark/[0.04]"
    }`;

    const content = (
      <>
        <span
          className={`shrink-0 flex h-5 w-5 items-center justify-start ${
            active ? "text-mono-dark" : "text-mono-light"
          }`}
        >
          <span
            className="material-symbols-rounded leading-none"
            style={{
              fontSize: 18,
              fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
            }}
          >
            {item.icon}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.trailingIcon ? (
          <span className="shrink-0 text-mono-light">
            <span
              className="material-symbols-rounded leading-none"
              style={{
                fontSize: 16,
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
              }}
            >
              {item.trailingIcon}
            </span>
          </span>
        ) : null}
      </>
    );

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {content}
        </a>
      );
    }

    return (
      <Link key={item.href} href={item.href} className={className}>
        {content}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 h-screen w-[260px] shrink-0 bg-white flex flex-col border-r border-bg-tertiary/60">
      <div className="pl-8 pr-5 pt-6 pb-4">
        <WorkspaceSwitcher layout="desktop" />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto pl-0 pr-5 overscroll-contain">
        <div className="space-y-1">{mainNav.map(navLink)}</div>

        <SidebarPagesPanel layout="desktop" />
      </nav>

      <div className="px-5 pb-3 space-y-0.5">
        {SIDEBAR_BOTTOM_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center py-2.5 text-base transition-all group ${
              pathname.startsWith("/preferences")
                ? "text-sovereign-blue font-medium"
                : "text-mono-light hover:text-mono-medium"
            }`}
          >
            <span
              className={`shrink-0 overflow-hidden flex items-center transition-all duration-500 ${
                pathname.startsWith("/preferences") ? "w-[20px]" : "w-0 group-hover:w-[20px]"
              }`}
            >
              <span className="h-0.5 w-[20px] rounded-full bg-sovereign-blue" />
            </span>
            <span className="ml-2">{item.label}</span>
          </Link>
        ))}
        <a
          href="mailto:expenseterminal@outlook.com"
          className="flex items-center py-2.5 text-base transition-all group text-mono-light hover:text-mono-medium"
        >
          <span className="shrink-0 overflow-hidden flex items-center transition-all duration-500 w-0 group-hover:w-[20px]">
            <span className="h-0.5 w-[20px] rounded-full bg-sovereign-blue" />
          </span>
          <span className="ml-2">Contact Our Team</span>
        </a>
      </div>
    </aside>
  );
}
