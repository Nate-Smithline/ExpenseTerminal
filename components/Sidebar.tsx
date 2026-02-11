"use client";

import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/inbox", label: "Inbox", icon: "📥" },
  { href: "/deductions", label: "Deductions", icon: "💰" },
  { href: "/reports", label: "Reports", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="w-[240px] bg-bg-tertiary flex flex-col justify-between px-6 py-8">
      <div>
        {/* User profile */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-full bg-bg-secondary flex items-center justify-center text-sm font-semibold text-mono-dark">
            NS
          </div>
          <div>
            <p className="text-sm font-semibold text-mono-dark">Nathan Smith</p>
            <p className="text-xs text-mono-light">View profile</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-bg-secondary text-mono-dark"
                  : "text-mono-medium hover:bg-bg-secondary/70"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                {item.label}
              </span>
              {item.href === "/inbox" && (
                <span className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-accent-sage/10 px-2 text-xs font-semibold text-accent-sage">
                  0
                </span>
              )}
            </a>
          ))}
        </nav>
      </div>

      {/* Bottom actions */}
      <div className="space-y-2">
        <button className="btn-secondary w-full text-sm justify-center">
          📤 Upload CSV
        </button>
        <button className="w-full rounded-md px-3 py-2 text-sm text-mono-medium hover:bg-bg-secondary/70 flex items-center justify-center gap-2">
          ❓ Help
        </button>
      </div>
    </aside>
  );
}

