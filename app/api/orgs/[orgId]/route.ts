import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";

const MAX_NAME_LEN = 65;

export async function PATCH(
  req: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
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
  const supabase = authClient as any;

  const { data: membership, error: mErr } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (mErr || !membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only workspace owners can update these settings" }, { status: 403 });
  }

  let body: {
    name?: unknown;
    icon_emoji?: unknown;
    icon_image_url?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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
    if (trimmed.length > MAX_NAME_LEN) {
      return NextResponse.json(
        { error: `Workspace name must be at most ${MAX_NAME_LEN} characters` },
        { status: 400 },
      );
    }
    patch.name = trimmed;
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

  const { data: org, error: uErr } = await supabase
    .from("orgs")
    .update(patch)
    .eq("id", orgId)
    .select("id, name, icon_emoji, icon_image_url")
    .single();

  if (uErr) {
    return NextResponse.json(
      { error: safeErrorMessage(uErr.message, "Failed to update workspace") },
      { status: 500 },
    );
  }

  return NextResponse.json({ org });
}
