import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserId, getSessionUserId } from "@/lib/get-current-user";

export type AuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; status: number; body: { error: string } };

export type RequireAuthOptions = {
  /** When true, allow a session whose email is not yet verified (signup onboarding). */
  allowUnverified?: boolean;
};

/**
 * Standardized auth check for API routes.
 * Returns authorized + userId, or 401 Unauthorized when not logged in.
 */
export async function requireAuth(
  supabase: SupabaseClient,
  options?: RequireAuthOptions
): Promise<AuthResult> {
  const userId = options?.allowUnverified
    ? await getSessionUserId(supabase)
    : await getCurrentUserId(supabase);
  if (!userId) {
    return { authorized: false, status: 401, body: { error: "Unauthorized" } };
  }
  return { authorized: true, userId };
}
