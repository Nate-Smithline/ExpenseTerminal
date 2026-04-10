import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { enrichOrgMemberRows } from "@/lib/orgs/enrich-org-members";
import { OrgPreferencesClient } from "@/app/preferences/OrgPreferencesClient";

export default async function PreferencesOrgPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const db = supabase as any;

  let orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    orgId = await ensureActiveOrgForUser(userId);
  }

  const [{ data: orgRow, error: orgErr }, { data: membership, error: memErr }, { data: memberRows }] =
    await Promise.all([
      db.from("orgs").select("id, name").eq("id", orgId).single(),
      db.from("org_memberships").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle(),
      db.from("org_memberships").select("user_id, role").eq("org_id", orgId),
    ]);

  if (orgErr || !orgRow || memErr || !membership) {
    redirect("/dashboard");
  }

  const rows = memberRows ?? [];
  const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data: p } = await db
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", userIds);
    profiles = p ?? [];
  }

  const profileById = new Map(profiles.map((p: any) => [p.id, p]));
  const rawMembers = rows.map((r: { user_id: string; role: string }) => {
    const p = profileById.get(r.user_id) as
      | { email?: string | null; display_name?: string | null; avatar_url?: string | null }
      | undefined;
    return {
      id: r.user_id,
      role: r.role,
      email: p?.email ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  });

  const initialMembers = await enrichOrgMemberRows(rawMembers);

  return (
    <OrgPreferencesClient
      currentUserId={userId}
      initialOrg={{
        id: orgRow.id,
        name: orgRow.name,
        role: membership.role,
      }}
      initialMembers={initialMembers}
    />
  );
}
