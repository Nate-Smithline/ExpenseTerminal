import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";

type PreferencesLayoutProps = {
  children: ReactNode;
};

export default async function PreferencesLayout({ children }: PreferencesLayoutProps) {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    redirect("/login");
  }

  return <>{children}</>;
}
