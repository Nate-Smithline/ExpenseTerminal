import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type OrgMemberRow = {
  id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type OrgPendingInviteRow = {
  id: string;
  email: string;
  last_sent_at: string;
};

/**
 * Fills missing email/display_name from Supabase Auth (profiles can lag or omit email for invited users).
 */
export async function enrichOrgMemberRows(rows: OrgMemberRow[]): Promise<OrgMemberRow[]> {
  if (rows.length === 0) return rows;

  const admin = createSupabaseServiceClient();

  const enriched = await Promise.all(
    rows.map(async (m) => {
      if (m.email && m.display_name?.trim()) {
        return m;
      }
      try {
        const { data, error } = await admin.auth.admin.getUserById(m.id);
        if (error || !data?.user) {
          return m;
        }
        const u = data.user;
        const email = m.email ?? u.email ?? null;
        const meta = u.user_metadata as Record<string, unknown> | undefined;
        const fromMeta =
          (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
          (typeof meta?.name === "string" && meta.name.trim()) ||
          null;
        const display_name =
          m.display_name?.trim() ||
          fromMeta ||
          (email ? email.split("@")[0] ?? null : null);
        return {
          ...m,
          email,
          display_name: display_name || null,
        };
      } catch {
        return m;
      }
    }),
  );

  return enriched;
}
