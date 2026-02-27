import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import {
  activityViewSettingsPatchSchema,
  ACTIVITY_SORT_COLUMNS,
  ACTIVITY_VISIBLE_COLUMNS,
} from "@/lib/validation/schemas";

const DEFAULT_VISIBLE_COLUMNS: string[] = [
  "date",
  "vendor",
  "amount",
  "transaction_type",
  "status",
  "category",
];

function defaultSettings() {
  const year = new Date().getFullYear();
  return {
    sort_column: "date",
    sort_asc: false,
    visible_columns: DEFAULT_VISIBLE_COLUMNS,
    filters: {
      status: null,
      transaction_type: null,
      search: "",
      date_from: `${year}-01-01`,
      date_to: `${year}-12-31`,
    },
  };
}

export async function GET(req: Request) {
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

  const { data, error } = await (supabase as any)
    .from("activity_view_settings")
    .select("sort_column,sort_asc,visible_columns,filters")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to load view settings") },
      { status: 500 }
    );
  }

  const def = defaultSettings();
  if (!data) {
    return NextResponse.json(def);
  }

  const visible = Array.isArray(data.visible_columns)
    ? (data.visible_columns as string[]).filter((k: string) =>
        (ACTIVITY_VISIBLE_COLUMNS as readonly string[]).includes(k)
      )
    : def.visible_columns;
  const filters =
    data.filters && typeof data.filters === "object"
      ? {
          status: data.filters.status ?? null,
          transaction_type: data.filters.transaction_type ?? null,
          search: typeof data.filters.search === "string" ? data.filters.search : "",
          date_from: typeof data.filters.date_from === "string" ? data.filters.date_from : def.filters.date_from,
          date_to: typeof data.filters.date_to === "string" ? data.filters.date_to : def.filters.date_to,
        }
      : def.filters;

  return NextResponse.json({
    sort_column: ACTIVITY_SORT_COLUMNS.includes(data.sort_column as any)
      ? data.sort_column
      : def.sort_column,
    sort_asc: typeof data.sort_asc === "boolean" ? data.sort_asc : def.sort_asc,
    visible_columns: visible.length > 0 ? visible : def.visible_columns,
    filters,
  });
}

export async function PATCH(req: Request) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = activityViewSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const def = defaultSettings();
  const { sort_column, sort_asc, visible_columns, filters } = parsed.data;

  const { data: existing } = await (supabase as any)
    .from("activity_view_settings")
    .select("id,sort_column,sort_asc,visible_columns,filters")
    .eq("user_id", userId)
    .maybeSingle();

  const nextSortColumn = sort_column ?? existing?.sort_column ?? def.sort_column;
  const nextSortAsc =
    sort_asc !== undefined ? sort_asc : (existing?.sort_asc ?? def.sort_asc);
  const nextVisible =
    visible_columns ??
    (Array.isArray(existing?.visible_columns) ? existing.visible_columns : def.visible_columns);
  const nextFilters = filters
    ? { ...def.filters, ...filters }
    : (existing?.filters && typeof existing.filters === "object"
        ? { ...def.filters, ...existing.filters }
        : def.filters);

  const payload = {
    user_id: userId,
    sort_column: nextSortColumn,
    sort_asc: nextSortAsc,
    visible_columns: nextVisible,
    filters: nextFilters,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await (supabase as any)
    .from("activity_view_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("sort_column,sort_asc,visible_columns,filters")
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to save view settings") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sort_column: saved.sort_column ?? def.sort_column,
    sort_asc: saved.sort_asc ?? def.sort_asc,
    visible_columns: Array.isArray(saved.visible_columns)
      ? saved.visible_columns
      : def.visible_columns,
    filters:
      saved.filters && typeof saved.filters === "object"
        ? {
            ...def.filters,
            ...saved.filters,
            date_from: saved.filters.date_from ?? def.filters.date_from,
            date_to: saved.filters.date_to ?? def.filters.date_to,
          }
        : def.filters,
  });
}
