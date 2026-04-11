import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { OrgMemberRow } from "@/lib/orgs/enrich-org-members";

export type OrgMembershipRow = { user_id: string; role: string };

/**
 * Loads every membership row and matching profile rows for a workspace.
 * Uses the service role — only call after confirming auth.uid() is a member of orgId.
 */
export async function loadOrgRosterForOrgId(orgId: string): Promise<{
  memberships: OrgMembershipRow[];
  profiles: Array<{
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>;
}> {
  const svc = createSupabaseServiceClient() as any;

  const { data: rows, error: mErr } = await svc
    .from("org_memberships")
    .select("user_id, role")
    .eq("org_id", orgId);

  if (mErr) {
    throw new Error(mErr.message ?? "Failed to load org memberships");
  }

  const memberships = (rows ?? []) as OrgMembershipRow[];
  const userIds = [...new Set(memberships.map((r) => r.user_id))];

  if (userIds.length === 0) {
    return { memberships: [], profiles: [] };
  }

  const { data: profiles, error: pErr } = await svc
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .in("id", userIds);

  if (pErr) {
    throw new Error(pErr.message ?? "Failed to load org member profiles");
  }

  return { memberships, profiles: profiles ?? [] };
}

export function rawOrgMembersFromRoster(
  memberships: OrgMembershipRow[],
  profiles: Array<{
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>
): OrgMemberRow[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  return memberships.map((r) => {
    const p = profileById.get(r.user_id);
    return {
      id: r.user_id,
      role: r.role,
      email: p?.email ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  });
}
