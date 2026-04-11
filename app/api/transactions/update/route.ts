import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { transactionUpdateBodySchema, uuidSchema } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { mergeCustomFieldsPatch, type PropertyDefinitionRow } from "@/lib/custom-field-validation";

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const [auth, body] = await Promise.all([
    requireAuth(authClient),
    req.json().catch(() => null as unknown),
  ]);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const supabase = authClient;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (body == null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = transactionUpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const {
    id,
    quick_label,
    business_purpose,
    notes,
    status,
    deduction_percent,
    category,
    schedule_c_line,
    date,
    vendor,
    amount,
    description,
    transaction_type,
    source,
    custom_fields: customFieldsPatch,
  } = parsed.data;

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (quick_label !== undefined) updatePayload.quick_label = quick_label;
  if (business_purpose !== undefined) updatePayload.business_purpose = business_purpose;
  if (notes !== undefined) updatePayload.notes = notes;
  if (status !== undefined) updatePayload.status = status;
  if (deduction_percent !== undefined) updatePayload.deduction_percent = deduction_percent;
  if (category !== undefined) updatePayload.category = category;
  if (schedule_c_line !== undefined) updatePayload.schedule_c_line = schedule_c_line;
  if (date !== undefined) updatePayload.date = new Date(date).toISOString().slice(0, 10);
  if (vendor !== undefined) {
    updatePayload.vendor = vendor;
    updatePayload.vendor_normalized = vendor.trim() ? normalizeVendor(vendor) : null;
  }
  if (amount !== undefined) updatePayload.amount = amount;
  if (description !== undefined) updatePayload.description = description;
  if (transaction_type !== undefined) updatePayload.transaction_type = transaction_type;
  if (source !== undefined) updatePayload.source = source;

  const hasCustomFields = customFieldsPatch !== undefined && Object.keys(customFieldsPatch).length > 0;

  // Single fetch of the transaction — reused for vendor backfill, custom fields merge, and auth.
  const { data: txRow, error: txErr } = await (supabase as any)
    .from("transactions")
    .select("id,user_id,data_source_id,vendor,vendor_normalized,custom_fields")
    .eq("id", id)
    .maybeSingle();

  if (txErr || !txRow) {
    return NextResponse.json(
      { error: safeErrorMessage(txErr?.message, "Transaction not found") },
      { status: 404 }
    );
  }

  // Vendor backfill (only when no explicit vendor change)
  if (updatePayload.vendor_normalized === undefined) {
    if (txRow.vendor != null && txRow.vendor_normalized == null && String(txRow.vendor).trim()) {
      updatePayload.vendor_normalized = normalizeVendor(String(txRow.vendor));
    }
  }

  // Resolve orgId once — needed for both custom fields and auth.
  let orgId: string | null = null;
  if (hasCustomFields || txRow.user_id !== userId) {
    orgId = await getActiveOrgId(supabase, userId);
  }

  if (hasCustomFields) {
    if (!orgId) {
      return NextResponse.json({ error: "Active org required to edit custom fields" }, { status: 400 });
    }
    const keys = Object.keys(customFieldsPatch!);
    if (keys.length > 40) {
      return NextResponse.json({ error: "Too many custom field keys" }, { status: 400 });
    }
    for (const k of keys) {
      if (!uuidSchema.safeParse(k).success) {
        return NextResponse.json({ error: "Invalid custom field key" }, { status: 400 });
      }
    }

    const existingRaw = txRow.custom_fields;
    const existing: Record<string, unknown> =
      existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw)
        ? (existingRaw as Record<string, unknown>)
        : {};

    const { data: defs, error: defErr } = await (supabase as any)
      .from("transaction_property_definitions")
      .select("id,type,config")
      .eq("org_id", orgId)
      .in("id", keys);

    if (defErr) {
      return NextResponse.json(
        { error: safeErrorMessage(defErr.message, "Failed to load property definitions") },
        { status: 500 }
      );
    }
    if (!defs || defs.length !== keys.length) {
      return NextResponse.json({ error: "Unknown or out-of-org property id" }, { status: 400 });
    }

    const map = new Map<string, PropertyDefinitionRow>(
      defs.map((d: { id: string; type: string; config: unknown }) => [
        d.id,
        { id: d.id, type: d.type, config: d.config as Record<string, unknown> | null },
      ])
    );

    const merged = mergeCustomFieldsPatch(existing, customFieldsPatch!, map);
    if (!merged.ok) {
      return NextResponse.json({ error: merged.error }, { status: 400 });
    }

    for (const key of keys) {
      const def = map.get(key);
      const val = merged.merged[key];
      if (def?.type === "org_user" && typeof val === "string" && val.length > 0) {
        const { data: mem } = await (supabase as any)
          .from("org_memberships")
          .select("user_id")
          .eq("org_id", orgId)
          .eq("user_id", val)
          .maybeSingle();
        if (!mem) {
          return NextResponse.json({ error: "Selected user is not in this org" }, { status: 400 });
        }
      }
    }

    updatePayload.custom_fields = merged.merged;
  }

  // Authorize: user owns the transaction, or is in the org that owns its data source.
  let authorized = txRow.user_id === userId;
  if (!authorized && txRow.data_source_id && orgId) {
    const { data: ds } = await (supabase as any)
      .from("data_sources")
      .select("org_id")
      .eq("id", txRow.data_source_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (ds) authorized = true;
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "You don't have permission to edit this transaction" },
      { status: 403 }
    );
  }

  const serviceClient = createSupabaseServiceClient();
  const { data: updatedRows, error } = await (serviceClient as any)
    .from("transactions")
    .update(updatePayload)
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to update transaction") },
      { status: 500 }
    );
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { error: "You don't have permission to edit this transaction" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
