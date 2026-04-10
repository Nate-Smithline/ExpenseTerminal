import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppBaseUrl } from "@/lib/app-base-url";

/**
 * Returns a Supabase verification link to send via custom email (e.g. Resend).
 * Tries `invite` first (new / unconfirmed users), then `magiclink` for existing accounts.
 */
export async function generateAuthInviteLink(
  admin: SupabaseClient,
  email: string,
): Promise<{ actionLink: string; userId: string | null; error: string | null }> {
  const base = getAppBaseUrl();
  const redirectTo = `${base}/auth/callback?next=${encodeURIComponent("/preferences/org")}`;

  const inviteRes = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (!inviteRes.error && inviteRes.data?.properties?.action_link && inviteRes.data.user?.id) {
    return {
      actionLink: inviteRes.data.properties.action_link,
      userId: inviteRes.data.user.id,
      error: null,
    };
  }

  const magicRes = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (magicRes.error) {
    return {
      actionLink: "",
      userId: null,
      error: magicRes.error.message ?? "Could not generate sign-in link",
    };
  }

  const link = magicRes.data?.properties?.action_link;
  const uid = magicRes.data?.user?.id ?? null;
  if (!link || !uid) {
    return { actionLink: "", userId: null, error: "Auth returned no action link" };
  }

  return { actionLink: link, userId: uid, error: null };
}
