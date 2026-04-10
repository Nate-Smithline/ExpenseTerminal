import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

function defaultActivityViewSettings() {
  const year = new Date().getFullYear();
  return {
    sort_column: "date",
    sort_asc: false,
    visible_columns: [
      "date",
      "vendor",
      "amount",
      "transaction_type",
      "status",
      "category",
    ],
    column_widths: {} as Record<string, number>,
    filters: {
      status: null,
      transaction_type: null,
      source: null,
      data_source_id: null,
      search: "",
      date_from: `${year}-01-01`,
      date_to: `${year}-12-31`,
    },
  };
}

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) {
    // Guard against drift: profiles.active_org_id may point at an org the user no longer belongs to.
    const { data: membership } = await (supabase as any)
      .from("org_memberships")
      .select("org_id")
      .eq("org_id", existing)
      .eq("user_id", userId)
      .maybeSingle();
    if (membership?.org_id) return existing;
  }
  return await ensureActiveOrgForUser(userId);
}

export async function GET(req: Request) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(
      req,
      userId,
      generalApiLimit
    );
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const supabase = authClient;

    const orgId = await resolveOrgId(supabase, userId);

    const { data, error } = await (supabase as any)
      .from("pages")
      .select("id,title,icon_type,icon_value,icon_color,position,created_at,updated_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to load pages") },
        { status: 500 }
      );
    }

    return NextResponse.json({ pages: data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load pages" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(
      req,
      userId,
      generalApiLimit
    );
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const supabase = authClient;
    const admin = createSupabaseServiceClient();

    const orgId = await resolveOrgId(supabase, userId);

    // Enforce org membership explicitly (service role read avoids any RLS surprises).
    const { data: membership } = await (admin as any)
      .from("org_memberships")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership?.org_id) {
      return NextResponse.json({ error: "You are not a member of the active org" }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const title = typeof body?.title === "string" ? body.title : "";
    const icon_type = body?.icon_type === "material" ? "material" : "emoji";
    const icon_value =
      typeof body?.icon_value === "string" && body.icon_value.trim().length > 0
        ? body.icon_value.trim()
        : "📄";
    const icon_color =
      typeof body?.icon_color === "string" && body.icon_color.trim().length > 0
        ? body.icon_color.trim()
        : "gray";

    const now = new Date().toISOString();
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
    // Insert with service role to avoid RLS insert failures; membership was checked above.
    const { data: page, error: pageErr } = await (admin as any)
      .from("pages")
      .insert({
        org_id: orgId,
        title,
        icon_type,
        icon_value,
        icon_color,
        position,
        created_by: userId,
        created_at: now,
        updated_at: now,
      })
      .select("id,title,icon_type,icon_value,icon_color,position,created_at,updated_at")
      .single();

    if (pageErr) {
      return NextResponse.json(
        { error: safeErrorMessage(pageErr.message, "Failed to create page") },
        { status: 500 }
      );
    }

    const def = defaultActivityViewSettings();
    const { error: settingsErr } = await (admin as any)
      .from("page_activity_view_settings")
      .insert({
        page_id: page.id,
        user_id: userId,
        sort_rules: [{ column: def.sort_column, asc: def.sort_asc }],
        sort_column: def.sort_column,
        sort_asc: def.sort_asc,
        visible_columns: def.visible_columns,
        column_widths: def.column_widths,
        filters: def.filters,
        created_at: now,
        updated_at: now,
      });

    if (settingsErr) {
      return NextResponse.json(
        {
          error: safeErrorMessage(
            settingsErr.message,
            "Page created but failed to initialize view settings"
          ),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ page }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create page" },
      { status: 500 }
    );
  }
}

