import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { GuidedSetupWizard } from "./GuidedSetupWizard";

export const metadata: Metadata = {
  title: "Guided setup — ExpenseTerminal",
  description: "Workspace, deductions, and bank connection.",
};

export default async function SetupPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  return (
    <div className="min-h-screen bg-warm-stock">
      <GuidedSetupWizard />
    </div>
  );
}
