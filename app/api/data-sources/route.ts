import {
  createSupabaseRouteClient,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { parseQueryLimit, parseQueryOffset } from "@/lib/validation/schemas";
import { deleteDataSourceForUser } from "@/lib/data-sources/delete-data-source";
export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  const url = new URL(req.url);
  const limit = parseQueryLimit(url.searchParams.get("limit"));
  const offset = parseQueryOffset(url.searchParams.get("offset"));

  const { data, error, count } = await (supabase as any)
    .from("data_sources")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error.message, "Failed to load accounts") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: data ?? [], count: count ?? (data?.length ?? 0) }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.userId;
  const { success: rlOkPost } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOkPost) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  let body: { name?: string; account_type?: string; institution?: string; source_type?: string; is_mixed_account?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const sourceType = body.source_type === "stripe" ? "stripe" : "manual";

  // Only insert columns that exist in minimal schema (omit source_type, connected_at, etc. if missing from schema cache).
  const insertCols = "id,user_id,name,account_type,institution,is_mixed_account,created_at";
  const { data, error } = await (supabase as any)
    .from("data_sources")
    .insert({
      user_id: userId,
      name: body.name,
      account_type: body.account_type || "other",
      institution: body.institution || null,
      is_mixed_account: body.is_mixed_account === true,
    })
    .select(insertCols)
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error.message, "Failed to create account") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  let body: { id: string; name?: string; account_type?: string; institution?: string; stripe_sync_start_date?: string | null; is_mixed_account?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!body.id) {
    return new Response(JSON.stringify({ error: "id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.account_type !== undefined) update.account_type = body.account_type;
  if (body.institution !== undefined) update.institution = body.institution || null;
  if (body.stripe_sync_start_date !== undefined) update.stripe_sync_start_date = body.stripe_sync_start_date;
  if (body.is_mixed_account !== undefined) update.is_mixed_account = Boolean(body.is_mixed_account);
  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ error: "No fields to update" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return full row so client keeps source_type (e.g. stripe) and other fields when editing name/institution.
  const { data, error } = await (supabase as any)
    .from("data_sources")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error.message, "Failed to update account") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  let body: { id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!body.id) {
    return new Response(JSON.stringify({ error: "id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await deleteDataSourceForUser(supabase, userId, body.id);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: safeErrorMessage(result.error, "Failed to delete account") }), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, transactionsDeleted: result.transactionsDeleted }),
    { headers: { "Content-Type": "application/json" } }
  );
}
