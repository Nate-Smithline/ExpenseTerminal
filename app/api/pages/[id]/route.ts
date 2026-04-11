import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { safeErrorMessage } from "@/lib/api/safe-error";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authClient = await createSupabaseRouteClient();
    const [auth, { id }, body] = await Promise.all([
      requireAuth(authClient),
      ctx.params,
      req.json().catch(() => null as unknown),
    ]);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const supabase = authClient;

    if (body == null || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if ("title" in body) {
      if (body.title === null) update.title = "";
      else if (typeof body.title === "string") update.title = body.title;
      else return NextResponse.json({ error: "title must be a string" }, { status: 400 });
    }
    if ("icon_type" in body) {
      if (body.icon_type === "emoji" || body.icon_type === "material") update.icon_type = body.icon_type;
      else return NextResponse.json({ error: "icon_type must be 'emoji' or 'material'" }, { status: 400 });
    }
    if ("icon_value" in body) {
      if (typeof body.icon_value === "string" && body.icon_value.trim().length > 0) update.icon_value = body.icon_value.trim();
      else return NextResponse.json({ error: "icon_value must be a non-empty string" }, { status: 400 });
    }
    if ("icon_color" in body) {
      if (typeof body.icon_color === "string" && body.icon_color.trim().length > 0) update.icon_color = body.icon_color.trim();
      else return NextResponse.json({ error: "icon_color must be a non-empty string" }, { status: 400 });
    }
    if ("full_width" in body) {
      if (typeof body.full_width === "boolean") update.full_width = body.full_width;
      else return NextResponse.json({ error: "full_width must be a boolean" }, { status: 400 });
    }
    if ("visibility" in body) {
      if (body.visibility === "org" || body.visibility === "restricted") update.visibility = body.visibility;
      else return NextResponse.json({ error: "visibility must be 'org' or 'restricted'" }, { status: 400 });
    }

    // RLS pages_update already enforces org membership — no resolveOrgId needed.
    // Filter by deleted_at IS NULL so soft-deleted pages are not resurrected.
    const { data, error } = await (supabase as any)
      .from("pages")
      .update(update)
      .eq("id", id)
      .is("deleted_at", null)
      .select(
        "id,title,icon_type,icon_value,icon_color,created_at,updated_at,full_width,visibility,org_id,created_by,deleted_at"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to update page") },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ page: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update page" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authClient = await createSupabaseRouteClient();
    const [auth, { id }] = await Promise.all([
      requireAuth(authClient),
      ctx.params,
    ]);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const supabase = authClient;

    const { data: updated, error } = await (supabase as any)
      .from("pages")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to move page to trash") },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete page" },
      { status: 500 }
    );
  }
}
