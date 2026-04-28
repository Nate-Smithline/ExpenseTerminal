import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mono-medium mb-2">Settings</p>
        <h1 className="font-display text-2xl md:text-3xl text-mono-dark">
          Account and preferences
        </h1>
        <p className="mt-2 text-sm text-mono-medium max-w-2xl">
          This is the v2 reboot settings hub. We’ll migrate only what we need from legacy.
        </p>
      </div>

      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <Link href="/settings/billing" className="block px-4 md:px-5 py-4 hover:bg-[#F0F1F7]">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-sm text-mono-dark">Billing</p>
              <p className="text-xs text-mono-medium mt-1">Manage your subscription</p>
            </div>
            <span className="material-symbols-rounded text-mono-light">chevron_right</span>
          </div>
        </Link>
        <Link href="/profile" className="block px-4 md:px-5 py-4 hover:bg-[#F0F1F7]">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-sm text-mono-dark">Profile</p>
              <p className="text-xs text-mono-medium mt-1">Name, email, password</p>
            </div>
            <span className="material-symbols-rounded text-mono-light">chevron_right</span>
          </div>
        </Link>
      </section>
    </div>
  );
}
