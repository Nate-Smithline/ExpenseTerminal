import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  getWorkspaceIdHintFromRequest,
  requireWorkspaceId,
} from "@/lib/workspaces/resolve-workspace";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type Sb = SupabaseClient<Database>;

const COOKIE_KEY = "et_workspace";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export async function getWorkspaceIdFromCookies(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(COOKIE_KEY)?.value ?? null;
  return v && v.trim() ? v.trim() : null;
}

async function persistWorkspaceIdCookie(workspaceId: string) {
  const store = await cookies();
  const existing = store.get(COOKIE_KEY)?.value?.trim() ?? null;
  if (existing === workspaceId) return;
  store.set(COOKIE_KEY, workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false,
  });
}

/** Align `et_workspace` after provisioning or explicit workspace picks. */
export async function syncWorkspaceSelectionCookie(workspaceId: string) {
  await persistWorkspaceIdCookie(workspaceId);
}

/**
 * Provision a default workspace for the user using the service role client.
 * Used when the user is authenticated but has no workspace membership yet
 * (e.g. fresh signup, or account data was cleaned out).
 */
async function provisionDefaultWorkspace(
  userId: string
): Promise<{ workspaceId: string } | { error: string; status: number }> {
  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch (e: any) {
    return {
      error: e?.message ?? "Service client unavailable",
      status: 500,
    };
  }

  // Double-check in case another request just created one.
  const { data: existing } = await (service as any)
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.workspace_id) {
    return { workspaceId: String(existing.workspace_id) };
  }

  // Prefer a human-readable workspace name from the profile.
  const { data: profile } = await (service as any)
    .from("profiles")
    .select("display_name,first_name,last_name,email")
    .eq("id", userId)
    .maybeSingle();

  const displayName =
    (profile?.display_name as string | null) ??
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ??
    "";
  const name =
    displayName ||
    (profile?.email as string | null) ||
    "My workspace";

  const { data: ws, error: wsErr } = await (service as any)
    .from("workspaces")
    .insert({ name })
    .select("id")
    .single();
  if (wsErr || !ws?.id) {
    return { error: wsErr?.message ?? "Failed to create workspace", status: 500 };
  }

  const { error: memErr } = await (service as any)
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
  if (memErr) {
    return { error: memErr.message, status: 500 };
  }

  return { workspaceId: String(ws.id) };
}

/** Exported for routes that need to bootstrap workspace list (e.g. GET /api/workspaces). */
export async function provisionDefaultWorkspaceForUser(
  userId: string
): Promise<{ workspaceId: string } | { error: string; status: number }> {
  return provisionDefaultWorkspace(userId);
}

async function resolveWorkspaceOrProvision(
  supabase: Sb,
  userId: string,
  hint: string | null
): Promise<{ workspaceId: string } | { error: string; status: number }> {
  const res = await requireWorkspaceId(supabase, userId, hint);
  if ("workspaceId" in res) return res;
  if (res.status === 404) return provisionDefaultWorkspace(userId);
  return res;
}

export async function requireWorkspaceIdServer(
  supabase: Sb,
  userId: string
): Promise<{ workspaceId: string } | { error: string; status: number }> {
  const hint = await getWorkspaceIdFromCookies();
  const out = await resolveWorkspaceOrProvision(supabase, userId, hint);
  if ("workspaceId" in out) {
    await persistWorkspaceIdCookie(out.workspaceId);
  }
  return out;
}

/**
 * Resolve workspace for API route handlers: merges cookie + request hint,
 * auto-provisions when the user has no membership, and syncs `et_workspace`.
 */
export async function requireWorkspaceIdForApi(
  supabase: Sb,
  userId: string,
  req: Request
): Promise<{ workspaceId: string } | { error: string; status: number }> {
  const fromReq = getWorkspaceIdHintFromRequest(req);
  const fromCookie = await getWorkspaceIdFromCookies();
  const hint = fromReq ?? fromCookie;
  const out = await resolveWorkspaceOrProvision(supabase, userId, hint);
  if ("workspaceId" in out) {
    await persistWorkspaceIdCookie(out.workspaceId);
  }
  return out;
}
