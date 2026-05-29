"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";

const TABS = [
  { id: "profile", label: "Profile", href: "/settings/profile" },
  { id: "billing", label: "Billing", href: "/settings/billing" },
  { id: "rules", label: "Rules", href: "/settings/rules" },
  { id: "notifications", label: "Notifications", href: "/settings/notifications" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="settings__nav">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`settings__nav-item ${active ? "is-active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
      <button
        type="button"
        className="settings__nav-item settings__nav-logout"
        onClick={handleLogout}
      >
        Log out
      </button>
    </nav>
  );
}
