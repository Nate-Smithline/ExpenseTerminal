import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

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
  const supabase = authClient as any;

  let orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    orgId = await ensureActiveOrgForUser(userId);
  }

  const { data: membership, error: mErr } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (mErr || !membership) {
    return NextResponse.json(
      { error: safeErrorMessage(mErr?.message, "Not a member of this org") },
      { status: 403 },
    );
  }

  const { data: org, error: oErr } = await supabase
    .from("orgs")
    .select("id, name, icon_emoji, icon_image_url")
    .eq("id", orgId)
    .single();

  if (oErr || !org) {
    return NextResponse.json(
      { error: safeErrorMessage(oErr?.message, "Failed to load org") },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: org.id,
    name: org.name,
    icon_emoji: org.icon_emoji ?? null,
    icon_image_url: org.icon_image_url ?? null,
    role: membership.role,
  });
}
