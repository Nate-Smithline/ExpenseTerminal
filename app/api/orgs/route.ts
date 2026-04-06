import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";

export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  const { data: memberships, error: mErr } = await (supabase as any)
    .from("org_memberships")
    .select("org_id, role, orgs(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json(
      { error: safeErrorMessage(mErr.message, "Failed to load orgs") },
      { status: 500 }
    );
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .single();

  const orgs = (memberships ?? []).map((m: any) => ({
    id: m.orgs?.id ?? m.org_id,
    name: m.orgs?.name ?? "Organization",
    role: m.role,
  }));

  return NextResponse.json({
    orgs,
    active_org_id: profile?.active_org_id ?? orgs[0]?.id ?? null,
  });
}
