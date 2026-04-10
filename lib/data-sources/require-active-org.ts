import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

/**
 * Active workspace for account CRUD (data_sources). Bootstraps a default org if missing.
 */
export async function requireOrgIdForAccounts(
  supabase: any,
  userId: string
): Promise<{ orgId: string } | { error: string; status: number }> {
  let orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    try {
      orgId = await ensureActiveOrgForUser(userId);
    } catch {
      return { error: "No active workspace", status: 400 };
    }
  }
  return { orgId };
}
