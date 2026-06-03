import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getOrCreateTriageProgress } from "@/lib/triage/progress";
import { TRIAGE_BADGES } from "@/lib/triage/progress";

export async function GET() {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const progress = await getOrCreateTriageProgress(supabase, auth.userId);

  return NextResponse.json({
    progress,
    badgeCatalog: TRIAGE_BADGES,
  });
}
