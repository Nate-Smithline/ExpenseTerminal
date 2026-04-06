/**
 * Resolve the active org for the current user.
 * Reads profiles.active_org_id; falls back to the first membership if unset.
 */
export async function getActiveOrgId(
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .single();

  if (profile?.active_org_id) return profile.active_org_id;

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return membership?.org_id ?? null;
}
