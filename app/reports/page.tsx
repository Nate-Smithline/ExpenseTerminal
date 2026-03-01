import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/get-current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  redirect("/activity");
}
