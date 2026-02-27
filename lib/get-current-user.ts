import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the current user's id from the session,
 * but only when their email has been confirmed.
 */
export async function getCurrentUserId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = (user.user_metadata as any) ?? {};
  const emailConfirmed =
    (user as any).email_confirmed_at != null ||
    meta.email_confirm === true;
  if (!emailConfirmed) return null;

  return user.id;
}

export function isAuthRequired(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";
}
