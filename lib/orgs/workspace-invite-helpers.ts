import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Svc = SupabaseClient<Database>;

export function extractInviteActionLink(
  genData: { properties?: { action_link?: string }; action_link?: string } | null | undefined
): string | null {
  const link =
    genData?.properties?.action_link ??
    (typeof genData?.action_link === "string" ? genData.action_link : undefined);
  return typeof link === "string" && link.length > 0 ? link : null;
}

export async function lookupAuthUserForInvite(svc: Svc, email: string): Promise<{ userId: string; userEmail: string } | null> {
  const { data, error } = await (svc as any).rpc("lookup_auth_user_for_invite", {
    check_email: email,
  });
  if (error || data == null) return null;
  const rows = Array.isArray(data) ? data : [data];
  const row = rows[0] as { user_id?: string; user_email?: string } | undefined;
  if (!row?.user_id) return null;
  return {
    userId: row.user_id,
    userEmail: (row.user_email ?? email).trim() || email,
  };
}

export async function ensureProfileForAuthUser(svc: Svc, authUserId: string, email: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await (svc as any).from("profiles").upsert(
    {
      id: authUserId,
      email,
      email_opt_in: false,
      updated_at: now,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
}

/** Create Supabase invite link with workspace metadata (new or re-invited user). */
export async function createWorkspaceInviteActionLink(
  svc: Svc,
  email: string,
  orgId: string,
  origin: string
): Promise<{ actionLink: string } | { error: Error }> {
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`;
  const { data: genData, error: genErr } = await svc.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: { invited_org_id: orgId },
    },
  });
  const actionLink = extractInviteActionLink(genData as { properties?: { action_link?: string }; action_link?: string });
  if (!genErr && actionLink) {
    return { actionLink };
  }
  return { error: genErr ?? new Error("Could not create invitation link") };
}

/** Sign-in link for an existing auth user to complete a workspace invite (pending-only path). */
export async function createWorkspaceMagicActionLink(
  svc: Svc,
  email: string,
  orgId: string,
  origin: string
): Promise<{ actionLink: string } | { error: Error }> {
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`;
  const { data: genData, error: genErr } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
      data: { invited_org_id: orgId },
    },
  });
  const actionLink = extractInviteActionLink(genData as { properties?: { action_link?: string }; action_link?: string });
  if (!genErr && actionLink) {
    return { actionLink };
  }
  return { error: genErr ?? new Error("Could not create sign-in link") };
}

export async function upsertPendingWorkspaceInvite(
  svc: Svc,
  args: { orgId: string; emailLower: string; invitedBy: string }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await (svc as any).from("org_pending_invites").upsert(
    {
      org_id: args.orgId,
      email: args.emailLower,
      invited_by: args.invitedBy,
      last_sent_at: now,
    },
    { onConflict: "org_id,email" }
  );
  if (error) throw new Error(error.message);
}
