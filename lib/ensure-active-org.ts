import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Ensures the user has an org + membership + profiles.active_org_id set.
 * Uses service role (bypasses RLS) and should only be called server-side.
 */
export async function ensureActiveOrgForUser(userId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.active_org_id) return profile.active_org_id as string;

  const { data: membership } = await (supabase as any)
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.org_id) {
    await (supabase as any)
      .from("profiles")
      .update({
        active_org_id: membership.org_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    return membership.org_id as string;
  }

  const now = new Date().toISOString();
  const { data: org, error: orgErr } = await (supabase as any)
    .from("orgs")
    .insert({ name: "My Organization", created_at: now, updated_at: now })
    .select("id")
    .single();

  if (orgErr || !org?.id) {
    throw new Error(orgErr?.message ?? "Failed to create org");
  }

  const { error: memErr } = await (supabase as any)
    .from("org_memberships")
    .insert({ org_id: org.id, user_id: userId, role: "owner", created_at: now });

  if (memErr) {
    throw new Error(memErr.message ?? "Failed to create membership");
  }

  await (supabase as any)
    .from("profiles")
    .update({ active_org_id: org.id, updated_at: now })
    .eq("id", userId);

  return org.id as string;
}

