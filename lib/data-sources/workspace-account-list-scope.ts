import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

/**
 * Whether the Accounts UI/API should list every data_source in the active org
 * (owner always; members only when org is not "restricted").
 */
export async function shouldListAllWorkspaceAccounts(
  supabase: Db,
  orgId: string,
  userId: string
): Promise<boolean> {
  const { data: memRaw } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const mem = memRaw as { role: string } | null;
  if (!mem) return false;
  if (mem.role === "owner") return true;

  const { data: orgRaw } = await supabase
    .from("orgs")
    .select("accounts_page_visibility")
    .eq("id", orgId)
    .maybeSingle();

  const org = orgRaw as { accounts_page_visibility: string | null } | null;
  return (org?.accounts_page_visibility ?? "org") !== "restricted";
}

/**
 * Whether the viewer may run sync / balance refresh / Plaid checks on a row (own account,
 * or another member’s account when the workspace lists shared accounts).
 */
export async function canMutateWorkspaceDataSource(
  supabase: Db,
  orgId: string,
  viewerUserId: string,
  accountOwnerUserId: string
): Promise<boolean> {
  if (accountOwnerUserId === viewerUserId) return true;
  return shouldListAllWorkspaceAccounts(supabase, orgId, viewerUserId);
}

/** Strip secrets from another member's account row before sending to the browser. */
export function sanitizeDataSourceForViewer<T extends Record<string, unknown>>(
  row: T,
  viewerUserId: string
): T {
  const ownerId = row.user_id as string | undefined;
  if (ownerId === viewerUserId) return row;
  return {
    ...row,
    plaid_access_token: null,
    plaid_cursor: null,
  } as T;
}
