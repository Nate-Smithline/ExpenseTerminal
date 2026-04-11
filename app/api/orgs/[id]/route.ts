/* eslint-disable @typescript-eslint/no-explicit-any -- orgs table not fully typed in routes */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { uuidSchema } from "@/lib/validation/schemas";

const ORG_NAME_MAX = 65;

/** PATCH /api/orgs/[id] — owners: name + branding; members: workspace name only (service update). */
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

    let body: {
      name?: unknown;
      icon_emoji?: unknown;
      icon_image_url?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { data: membership, error: memErr } = await (authClient as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr || !membership?.role) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    const isOwner = membership.role === "owner";

    const patch: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return NextResponse.json({ error: "name must be a string" }, { status: 400 });
      }
      const trimmed = body.name.trim();
      if (trimmed.length === 0) {
        return NextResponse.json({ error: "Workspace name cannot be empty" }, { status: 400 });
      }
      if (trimmed.length > ORG_NAME_MAX) {
        return NextResponse.json(
          { error: `Workspace name must be at most ${ORG_NAME_MAX} characters` },
          { status: 400 },
        );
      }
      patch.name = trimmed;
    }

    if (!isOwner) {
      if (body.icon_emoji !== undefined || body.icon_image_url !== undefined) {
        return NextResponse.json(
          { error: "Only workspace owners can update workspace branding (icons)" },
          { status: 403 },
        );
      }
      if (body.name === undefined) {
        return NextResponse.json({ error: "Members can only update the workspace name" }, { status: 400 });
      }
      if (Object.keys(patch).length === 1) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      let svc: ReturnType<typeof createSupabaseServiceClient>;
      try {
        svc = createSupabaseServiceClient();
      } catch {
        return NextResponse.json(
          { error: "Renaming the workspace requires server configuration (missing service key)." },
          { status: 503 },
        );
      }

      const { data: org, error: upErr } = await (svc as any)
        .from("orgs")
        .update(patch)
        .eq("id", orgId)
        .select("id, name, icon_emoji, icon_image_url")
        .maybeSingle();

      if (upErr) {
        return NextResponse.json(
          { error: safeErrorMessage(upErr.message, "Could not update workspace") },
          { status: 500 },
        );
      }
      if (!org) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      }

      return NextResponse.json({ org });
    }

    if (body.icon_emoji !== undefined) {
      if (body.icon_emoji === null) {
        patch.icon_emoji = null;
      } else if (typeof body.icon_emoji === "string") {
        const t = body.icon_emoji.trim();
        patch.icon_emoji = t.length === 0 ? null : t.slice(0, 16);
      } else {
        return NextResponse.json({ error: "icon_emoji must be a string or null" }, { status: 400 });
      }
    }

    if (body.icon_image_url !== undefined) {
      if (body.icon_image_url === null) {
        patch.icon_image_url = null;
      } else if (typeof body.icon_image_url === "string") {
        const t = body.icon_image_url.trim();
        if (t.length === 0) {
          patch.icon_image_url = null;
        } else if (t.length > 2048 || !/^https?:\/\//i.test(t)) {
          return NextResponse.json(
            { error: "icon_image_url must be an http(s) URL under 2048 characters" },
            { status: 400 },
          );
        } else {
          patch.icon_image_url = t;
        }
      } else {
        return NextResponse.json({ error: "icon_image_url must be a string or null" }, { status: 400 });
      }
    }

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: org, error: upErr } = await (authClient as any)
      .from("orgs")
      .update(patch)
      .eq("id", orgId)
      .select("id, name, icon_emoji, icon_image_url")
      .maybeSingle();

    if (upErr) {
      return NextResponse.json(
        { error: safeErrorMessage(upErr.message, "Could not update workspace") },
        { status: 500 },
      );
    }
    if (!org) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ org });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update workspace" },
      { status: 500 },
    );
  }
}
