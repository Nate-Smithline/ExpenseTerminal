"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";

type Tab = {
  href: string;
  label: string;
};

export function PreferencesHeader({ tabs }: { tabs: readonly Tab[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const supabase = createSupabaseClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const activeTab = tabs.find((t) => pathname === t.href) ?? tabs[0];

  // Adjust title label for Org to show \"Org Profile\" instead of just \"Org\"
  const title =
    activeTab.href === "/preferences/org"
      ? "Org Profile"
      : activeTab.label;

  return (
    <div className="flex items-center justify-between mb-3">
      <button
        type="button"
        onClick={handleLogout}
        className="text-xs font-medium font-sans px-3 py-1.5 bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#F5F0E8]"
      >
        Logout
      </button>
      <div className="flex-1 text-center">
        <div
          role="heading"
          aria-level={1}
          className="text-xl font-normal font-sans text-mono-dark"
        >
          {title}
        </div>
      </div>
      <div className="w-[72px]" aria-hidden />
    </div>
  );
}

