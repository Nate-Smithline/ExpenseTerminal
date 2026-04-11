/* eslint-disable @typescript-eslint/no-explicit-any -- pages/orgs tables not fully typed */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { enrichOrgMemberRows, type OrgMemberRow } from "@/lib/orgs/enrich-org-members";
import { loadOrgRosterForOrgId, rawOrgMembersFromRoster } from "@/lib/orgs/load-org-roster";

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  return await ensureActiveOrgForUser(userId);
}

export async function GET(req: Request) {
  try {
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

    const orgId = await resolveOrgId(supabase, userId);

    const { data: viewerRow, error: viewerErr } = await (supabase as any)
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (viewerErr || !viewerRow) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    let rawMembers: OrgMemberRow[];
    try {
      const roster = await loadOrgRosterForOrgId(orgId);
      rawMembers = rawOrgMembersFromRoster(roster.memberships, roster.profiles);
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error: safeErrorMessage(
            e instanceof Error ? e.message : String(e),
            "Failed to load members"
          ),
        },
        { status: 500 }
      );
    }

    const enriched = await enrichOrgMemberRows(rawMembers);

    const memberEmailsLower = new Set(
      enriched
        .map((m) => (typeof m.email === "string" ? m.email.trim().toLowerCase() : ""))
        .filter(Boolean)
    );

    const { data: pendingRows, error: pendErr } = await (supabase as any)
      .from("org_pending_invites")
      .select("id, email, last_sent_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (pendErr) {
      return NextResponse.json(
        { error: safeErrorMessage(pendErr.message, "Failed to load pending invites") },
        { status: 500 }
      );
    }

    type PendingRow = { id: string; email: string; last_sent_at: string };
    const pendingInvites = (pendingRows ?? [])
      .map((r: PendingRow) => ({
        id: r.id,
        email: r.email,
        last_sent_at: r.last_sent_at,
      }))
      .filter((p: PendingRow) => !memberEmailsLower.has(String(p.email).trim().toLowerCase()));

    return NextResponse.json({ members: enriched, pendingInvites });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load members" },
      { status: 500 }
    );
  }
}
