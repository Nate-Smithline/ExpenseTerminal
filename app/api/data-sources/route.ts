import {
  createSupabaseRouteClient,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { parseQueryLimit, parseQueryOffset } from "@/lib/validation/schemas";
import { isBrandColorId } from "@/lib/brand-palette";
import { requireOrgIdForAccounts } from "@/lib/data-sources/require-active-org";

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

  const org = await requireOrgIdForAccounts(supabase as any, userId);
  if ("error" in org) {
    return new Response(JSON.stringify({ error: org.error }), {
      status: org.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const limit = parseQueryLimit(url.searchParams.get("limit"));
  const offset = parseQueryOffset(url.searchParams.get("offset"));

  const { data, error, count } = await (supabase as any)
    .from("data_sources")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("org_id", org.orgId)
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
      "Cache-Control": "private, max-age=300",
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

  const orgPost = await requireOrgIdForAccounts(supabase as any, userId);
  if ("error" in orgPost) {
    return new Response(JSON.stringify({ error: orgPost.error }), {
      status: orgPost.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    name?: string;
    account_type?: string;
    institution?: string;
    source_type?: string;
    manual_balance?: number | null;
    manual_balance_iso_currency_code?: string | null;
  };
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

  const insertRow: Record<string, unknown> = {
    org_id: orgPost.orgId,
    user_id: userId,
    name: body.name,
    account_type: body.account_type || "other",
    institution: body.institution || null,
    source_type: sourceType,
  };
  if (sourceType === "manual") {
    if (body.manual_balance != null && Number.isFinite(Number(body.manual_balance))) {
      insertRow.manual_balance = Number(Number(body.manual_balance).toFixed(2));
    }
    const cur = typeof body.manual_balance_iso_currency_code === "string" ? body.manual_balance_iso_currency_code.trim() : "";
    if (cur.length === 3) {
      insertRow.manual_balance_iso_currency_code = cur.toUpperCase();
    }
  }

  const { data, error } = await (supabase as any)
    .from("data_sources")
    .insert(insertRow)
    .select()
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

  const org = await requireOrgIdForAccounts(supabase as any, userId);
  if ("error" in org) {
    return new Response(JSON.stringify({ error: org.error }), {
      status: org.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    id: string;
    name?: string;
    account_type?: string;
    institution?: string;
    stripe_sync_start_date?: string | null;
    manual_balance?: number | null;
    manual_balance_iso_currency_code?: string | null;
    brand_color_id?: string;
    balance_class?: "asset" | "liability" | null;
    include_in_net_worth?: boolean;
    balance_value_preference?: "current" | "available" | "manual" | null;
  };
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

  const { data: existingRow, error: existingErr } = await (supabase as any)
    .from("data_sources")
    .select("source_type")
    .eq("id", body.id)
    .eq("user_id", userId)
    .eq("org_id", org.orgId)
    .maybeSingle();

  if (existingErr || !existingRow) {
    return new Response(JSON.stringify({ error: "Data source not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.account_type !== undefined) update.account_type = body.account_type;
  if (body.institution !== undefined) update.institution = body.institution || null;
  if (body.stripe_sync_start_date !== undefined) update.stripe_sync_start_date = body.stripe_sync_start_date;
  if (body.manual_balance !== undefined || body.manual_balance_iso_currency_code !== undefined) {
    if (existingRow.source_type !== "manual") {
      return new Response(
        JSON.stringify({ error: "Balance can only be set on manual accounts" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (body.manual_balance !== undefined) {
      update.manual_balance =
        body.manual_balance == null ? null : Number(Number(body.manual_balance).toFixed(2));
    }
    if (body.manual_balance_iso_currency_code !== undefined) {
      const c = body.manual_balance_iso_currency_code?.trim() ?? "";
      update.manual_balance_iso_currency_code = c.length === 3 ? c.toUpperCase() : "USD";
    }
  }
  if (body.brand_color_id !== undefined) {
    if (!isBrandColorId(body.brand_color_id)) {
      return new Response(JSON.stringify({ error: "Invalid brand color" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    update.brand_color_id = body.brand_color_id;
  }

  if (body.balance_class !== undefined) {
    if (body.balance_class !== "asset" && body.balance_class !== "liability" && body.balance_class !== null) {
      return new Response(JSON.stringify({ error: "Invalid balance class" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    update.balance_class = body.balance_class;
  }

  if (body.include_in_net_worth !== undefined) {
    update.include_in_net_worth = !!body.include_in_net_worth;
  }

  if (body.balance_value_preference !== undefined) {
    const v = body.balance_value_preference;
    if (v !== "current" && v !== "available" && v !== "manual" && v !== null) {
      return new Response(JSON.stringify({ error: "Invalid balance value preference" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    update.balance_value_preference = v;
  }
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
    .eq("org_id", org.orgId)
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

  const org = await requireOrgIdForAccounts(supabase as any, userId);
  if ("error" in org) {
    return new Response(JSON.stringify({ error: org.error }), {
      status: org.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { id: string; delete_transactions?: boolean };
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

  const { data: row, error: fetchError } = await (supabase as any)
    .from("data_sources")
    .select("id")
    .eq("id", body.id)
    .eq("user_id", userId)
    .eq("org_id", org.orgId)
    .single();

  if (fetchError || !row) {
    return new Response(JSON.stringify({ error: "Data source not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (body.delete_transactions) {
    const { error: delTxError } = await (supabase as any)
      .from("transactions")
      .delete()
      .eq("data_source_id", body.id)
      .eq("user_id", userId);
    if (delTxError) {
      return new Response(JSON.stringify({ error: safeErrorMessage(delTxError.message, "Failed to delete transactions") }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    const { error: unlinkError } = await (supabase as any)
      .from("transactions")
      .update({ data_source_id: null })
      .eq("data_source_id", body.id)
      .eq("user_id", userId);
    if (unlinkError) {
      return new Response(JSON.stringify({ error: safeErrorMessage(unlinkError.message, "Failed to unlink transactions") }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const { error: delError } = await (supabase as any)
    .from("data_sources")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId);

  if (delError) {
    return new Response(JSON.stringify({ error: safeErrorMessage(delError.message, "Failed to delete account") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
