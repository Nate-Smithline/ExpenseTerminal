/**
 * All user IDs that belong to an org (for scoping org-wide rules to transactions).
 */
export async function fetchOrgMemberUserIds(supabase: any, orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", orgId);
  if (error) {
    console.warn("[org-rules] fetchOrgMemberUserIds", error.message);
    return [];
  }
  return (data ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
}
