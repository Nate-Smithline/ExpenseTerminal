import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { applyAllMarkerRulesForUser } from "@/lib/triage/marker-rules";

/** Apply all saved marker rules to untagged transactions (e.g. after linking an account). */
export async function POST() {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const result = await applyAllMarkerRulesForUser(supabase, auth.userId);
  return NextResponse.json(result);
}
