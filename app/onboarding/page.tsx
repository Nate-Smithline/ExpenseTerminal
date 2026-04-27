import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/get-current-user";
import { SignupOnboardingClient } from "./SignupOnboardingClient";

export const metadata: Metadata = {
  title: "Get started — ExpenseTerminal",
  description: "Create your account and set up your tax profile.",
};

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getSessionUserId(supabase);
  if (!userId) redirect("/login?next=/onboarding");

  return (
    <div className="min-h-screen bg-warm-stock">
      <Suspense
        fallback={
          <div className="mx-auto max-w-xl animate-pulse px-4 py-14">
            <div className="h-1.5 rounded-full bg-frost" />
          </div>
        }
      >
        <SignupOnboardingClient />
      </Suspense>
    </div>
  );
}
