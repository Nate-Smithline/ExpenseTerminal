"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
};

export function PreferencesTabs({ tabs }: { tabs: readonly Tab[] }) {
  const pathname = usePathname();

  return (
    <div className="inline-flex border border-[#8A9BB0] bg-white rounded-none text-xs md:text-sm font-sans font-medium">
      {tabs.map((tab, index) => {
        const active = pathname === tab.href;
        const isLast = index === tabs.length - 1;

        const baseClasses =
          "px-3 py-1.5 min-w-[90px] text-center transition-colors";
        const activeClasses = "bg-[#8A9BB0] text-black";
        const inactiveClasses = "bg-white text-black hover:bg-[#8A9BB0]/10";
        const dividerClasses = isLast ? "" : "border-r border-[#8A9BB0]";

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${baseClasses} ${dividerClasses} ${
              active ? activeClasses : inactiveClasses
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

