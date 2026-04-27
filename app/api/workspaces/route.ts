import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import {
  provisionDefaultWorkspaceForUser,
  syncWorkspaceSelectionCookie,
} from "@/lib/workspaces/server";

/**
 * GET: list workspaces for current user (membership-based).
 * POST: create a new workspace and add caller as owner.
 */
export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = authClient;
  const memberSelect =
    "role, joined_at, workspaces:workspaces(id,name,business_type,tax_filing_status,fiscal_year_start,created_at,updated_at)";

  let { data, error } = await (supabase as any)
    .from("workspace_members")
    .select(memberSelect)
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to load workspaces") },
      { status: 500 }
    );
  }

  if (!data?.length) {
    const created = await provisionDefaultWorkspaceForUser(userId);
    if ("error" in created) {
      return NextResponse.json(
        { error: safeErrorMessage(created.error, "Failed to provision workspace") },
        { status: created.status }
      );
    }
    await syncWorkspaceSelectionCookie(created.workspaceId);
    ({ data, error } = await (supabase as any)
      .from("workspace_members")
      .select(memberSelect)
      .eq("user_id", userId)
      .order("joined_at", { ascending: false }));
    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to load workspaces") },
        { status: 500 }
      );
    }
  }

  const rows =
    (data ?? []).map((r: any) => ({
      role: r.role,
      joined_at: r.joined_at,
      ...(r.workspaces ?? {}),
    })) ?? [];

  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: { name?: string; business_type?: string | null } = {};
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch (e: any) {
    return NextResponse.json(
      { error: safeErrorMessage(e?.message, "Server configuration error") },
      { status: 500 }
    );
  }

  const { data: ws, error: wsErr } = await (service as any)
    .from("workspaces")
    .insert({
      name,
      business_type: body.business_type ?? null,
    })
    .select("id,name,business_type,tax_filing_status,fiscal_year_start,created_at,updated_at")
    .single();

  if (wsErr) {
    return NextResponse.json(
      { error: safeErrorMessage(wsErr.message, "Failed to create workspace") },
      { status: 500 }
    );
  }

  const { error: memErr } = await (service as any)
    .from("workspace_members")
    .insert({
      workspace_id: ws.id,
      user_id: userId,
      role: "owner",
    });

  if (memErr) {
    return NextResponse.json(
      { error: safeErrorMessage(memErr.message, "Failed to add workspace member") },
      { status: 500 }
    );
  }

  await syncWorkspaceSelectionCookie(String(ws.id));

  return NextResponse.json(ws);
}

