/* eslint-disable @typescript-eslint/no-explicit-any -- pages tables not fully typed */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  return await ensureActiveOrgForUser(userId);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const supabase = authClient;
    const orgId = await resolveOrgId(supabase, userId);
    const { id: sourceId } = await ctx.params;

    const { data: src, error: srcErr } = await (supabase as any)
      .from("pages")
      .select("id,title,icon_type,icon_value,icon_color,visibility,full_width")
      .eq("id", sourceId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (srcErr) {
      return NextResponse.json(
        { error: safeErrorMessage(srcErr.message, "Failed to load page") },
        { status: 500 }
      );
    }
    if (!src) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const baseTitle = typeof src.title === "string" ? src.title.trim() : "";
    const newTitle = baseTitle ? `${baseTitle} (copy)` : "Untitled (copy)";
    const now = new Date().toISOString();

    // Place the duplicate near the top of the sidebar order.
    const { data: firstPosRow } = await (supabase as any)
      .from("pages")
      .select("position")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    const position =
      typeof firstPosRow?.position === "number" && Number.isFinite(firstPosRow.position)
        ? firstPosRow.position - 1000
        : -1000;

    const { data: page, error: insErr } = await (supabase as any)
      .from("pages")
      .insert({
        org_id: orgId,
        title: newTitle,
        icon_type: src.icon_type ?? "emoji",
        icon_value: src.icon_value ?? "📄",
        icon_color: src.icon_color ?? "grey",
        visibility: src.visibility ?? "org",
        full_width: Boolean(src.full_width),
        position,
        created_by: userId,
        created_at: now,
        updated_at: now,
      })
      .select("id,title,icon_type,icon_value,icon_color,position,created_at,updated_at,visibility,full_width")
      .single();

    if (insErr || !page) {
      return NextResponse.json(
        {
          error: safeErrorMessage(
            insErr?.message,
            "Failed to duplicate page"
          ),
        },
        { status: 500 }
      );
    }

    const { data: settings } = await (supabase as any)
      .from("page_activity_view_settings")
      .select("sort_rules,sort_column,sort_asc,visible_columns,column_widths,filters")
      .eq("page_id", sourceId)
      .maybeSingle();

    const defVisible = ["date", "vendor", "amount", "transaction_type", "status", "category"];
    const defFilters = {
      status: null,
      transaction_type: null,
      source: null,
      data_source_id: null,
      search: "",
      date_from: `${new Date().getFullYear()}-01-01`,
      date_to: `${new Date().getFullYear()}-12-31`,
    };

    const visibleColumns = Array.isArray(settings?.visible_columns) ? settings.visible_columns : defVisible;
    const sortRules = Array.isArray((settings as any)?.sort_rules)
      ? (settings as any).sort_rules
      : [{ column: settings?.sort_column ?? "date", asc: settings?.sort_asc ?? false }];

    const { error: setErr } = await (supabase as any).from("page_activity_view_settings").insert({
      page_id: page.id,
      user_id: userId,
      sort_rules: sortRules,
      sort_column: settings?.sort_column ?? "date",
      sort_asc: settings?.sort_asc ?? false,
      visible_columns: visibleColumns.length > 0 ? visibleColumns : defVisible,
      column_widths: settings?.column_widths && typeof settings.column_widths === "object" ? settings.column_widths : {},
      filters:
        settings?.filters && typeof settings.filters === "object"
          ? { ...defFilters, ...settings.filters }
          : defFilters,
      created_at: now,
      updated_at: now,
    });

    if (setErr) {
      const svc = createSupabaseServiceClient();
      await (svc as any).from("pages").delete().eq("id", page.id);
      return NextResponse.json(
        { error: safeErrorMessage(setErr.message, "Failed to copy view settings") },
        { status: 500 }
      );
    }

    return NextResponse.json({ page }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to duplicate page" },
      { status: 500 }
    );
  }
}
