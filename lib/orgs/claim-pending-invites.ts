import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Svc = SupabaseClient<Database>;

function isUniqueViolation(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("duplicate") || m.includes("unique");
}

/**
 * After a user signs in (magic link, invite completion, etc.), add them to any workspace
 * that has a pending invite for their email, then remove those pending rows.
 */
export async function claimPendingOrgMembershipsForSessionUser(
  svc: Svc,
  userId: string,
  email: string
): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) return;
  const emailLower = trimmed.toLowerCase();

  const now = new Date().toISOString();
  await (svc as any).from("profiles").upsert(
    { id: userId, email: trimmed, updated_at: now },
    { onConflict: "id" }
  );

  const { data: rows } = await (svc as any)
    .from("org_pending_invites")
    .select("id, org_id")
    .eq("email", emailLower);

  for (const row of rows ?? []) {
    const { error: insErr } = await (svc as any).from("org_memberships").insert({
      org_id: row.org_id,
      user_id: userId,
      role: "member",
    });

    if (!insErr || isUniqueViolation(insErr)) {
      await (svc as any).from("org_pending_invites").delete().eq("id", row.id);
    }
  }
}
