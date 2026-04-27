import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Sb = SupabaseClient<Database>;

function parseWorkspaceId(input: string | null | undefined): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  // Workspace IDs are UUIDs (Supabase).
  return v;
}

export function getWorkspaceIdHintFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  const qp = parseWorkspaceId(url.searchParams.get("workspace_id"));
  const hdr = parseWorkspaceId(req.headers.get("x-workspace-id"));
  return qp ?? hdr;
}

/**
 * Resolve a workspace id for the authenticated user.
 * - If a hint is provided, verify membership and return it.
 * - Else return the user's first workspace (most recent membership).
 */
export async function requireWorkspaceId(
  supabase: Sb,
  userId: string,
  hint: string | null
): Promise<{ workspaceId: string } | { error: string; status: number }> {
  if (hint) {
    const { data: member, error } = await (supabase as any)
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("workspace_id", hint)
      .maybeSingle();
    if (error) return { error: error.message, status: 500 };
    // If the workspace hint is stale (cookie/header points to a workspace the user
    // is no longer a member of), fall back to resolving their latest membership.
    if (member?.workspace_id) {
      return { workspaceId: String(member.workspace_id) };
    }
  }

  const { data: member, error } = await (supabase as any)
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!member?.workspace_id) return { error: "No workspace found", status: 404 };
  return { workspaceId: String(member.workspace_id) };
}

