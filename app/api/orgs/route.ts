/* eslint-disable @typescript-eslint/no-explicit-any -- supabase generated row shapes */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
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
    .select("active_org_id, email")
    .eq("id", userId)
    .single();

  const orgs = (memberships ?? []).map((m: any) => ({
    id: m.orgs?.id ?? m.org_id,
    name: m.orgs?.name ?? "Organization",
    role: m.role,
  }));

  const memberOrgIds = new Set(orgs.map((o: { id: string }) => o.id));
  const emailLower =
    typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";

  let pending_invites: Array<{ id: string; org_id: string; name: string }> = [];
  if (emailLower) {
    try {
      const svc = createSupabaseServiceClient();
      const { data: pendingRows, error: pErr } = await (svc as any)
        .from("org_pending_invites")
        .select("id, org_id, orgs(name)")
        .eq("email", emailLower);

      if (!pErr && pendingRows?.length) {
        pending_invites = pendingRows
          .filter((row: any) => row.org_id && !memberOrgIds.has(row.org_id))
          .map((row: any) => ({
            id: row.id,
            org_id: row.org_id,
            name:
              typeof row.orgs?.name === "string" && row.orgs.name.trim()
                ? row.orgs.name.trim()
                : "Workspace",
          }));
      }
    } catch {
      /* missing service key in dev — omit pending list */
    }
  }

  return NextResponse.json({
    orgs,
    active_org_id: profile?.active_org_id ?? orgs[0]?.id ?? null,
    pending_invites,
  });
}
