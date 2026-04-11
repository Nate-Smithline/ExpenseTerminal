import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import {
  enrichOrgMemberRows,
  type OrgMemberRow,
  type OrgPendingInviteRow,
} from "@/lib/orgs/enrich-org-members";
import { loadOrgRosterForOrgId, rawOrgMembersFromRoster } from "@/lib/orgs/load-org-roster";
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

  const [{ data: orgRow, error: orgErr }, { data: membership, error: memErr }] = await Promise.all([
    db.from("orgs").select("id, name").eq("id", orgId).single(),
    db.from("org_memberships").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle(),
  ]);

  if (orgErr || !orgRow || memErr || !membership) {
    redirect("/dashboard");
  }

  const roster = await loadOrgRosterForOrgId(orgId);
  const rawMembers = rawOrgMembersFromRoster(roster.memberships, roster.profiles);

  const initialMembers = await enrichOrgMemberRows(rawMembers);

  const memberEmailsLower = new Set(
    initialMembers
      .map((m) => (typeof m.email === "string" ? m.email.trim().toLowerCase() : ""))
      .filter(Boolean)
  );

  let initialPendingInvites: OrgPendingInviteRow[] = [];
  const { data: pendingRows } = await db
    .from("org_pending_invites")
    .select("id, email, last_sent_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (pendingRows?.length) {
    initialPendingInvites = (pendingRows as OrgPendingInviteRow[]).filter(
      (p) => !memberEmailsLower.has(String(p.email).trim().toLowerCase())
    );
  }

  return (
    <OrgPreferencesClient
      currentUserId={userId}
      initialOrg={{
        id: orgRow.id,
        name: orgRow.name,
        role: membership.role,
      }}
      initialMembers={initialMembers}
      initialPendingInvites={initialPendingInvites}
    />
  );
}
