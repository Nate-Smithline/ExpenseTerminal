/**
 * Fetch minimal profile fields for server-side use (e.g. onboarding_progress for tax year).
 */
export async function getProfileOnboarding(
  supabase: any,
  userId: string
): Promise<{ onboarding_progress?: { selected_tax_year?: number } | null } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_progress")
    .eq("id", userId)
    .single();
  if (error || data == null) return null;
  return data;
}
