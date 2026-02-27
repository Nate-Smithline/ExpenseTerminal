import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { BillingClient } from "./BillingClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const resolved = searchParams != null ? await searchParams : {};
  const sessionId =
    typeof resolved.session_id === "string" ? resolved.session_id : undefined;

  return <BillingClient checkoutSessionId={sessionId} />;
}
