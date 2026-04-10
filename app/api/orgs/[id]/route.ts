/* eslint-disable @typescript-eslint/no-explicit-any -- orgs table not fully typed in routes */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { uuidSchema } from "@/lib/validation/schemas";

const ORG_NAME_MAX = 65;

/** PATCH /api/orgs/[id] — update workspace (owners only). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id: orgId } = await ctx.params;
    if (!uuidSchema.safeParse(orgId).success) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const nameRaw = (body as { name?: string })?.name;
    if (typeof nameRaw !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const name = nameRaw.trim();
    if (!name) {
      return NextResponse.json({ error: "Workspace name cannot be empty" }, { status: 400 });
    }
    if (name.length > ORG_NAME_MAX) {
      return NextResponse.json(
        { error: `Workspace name must be at most ${ORG_NAME_MAX} characters` },
        { status: 400 }
      );
    }

    const { data: membership, error: memErr } = await (authClient as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr || membership?.role !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can edit the workspace name" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: org, error: upErr } = await (authClient as any)
      .from("orgs")
      .update({ name, updated_at: now })
      .eq("id", orgId)
      .select("id, name")
      .maybeSingle();

    if (upErr) {
      return NextResponse.json(
        { error: safeErrorMessage(upErr.message, "Could not update workspace") },
        { status: 500 }
      );
    }
    if (!org) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ org });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update workspace" },
      { status: 500 }
    );
  }
}
