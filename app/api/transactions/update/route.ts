import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { transactionUpdateBodySchema, uuidSchema } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { mergeCustomFieldsPatch, type PropertyDefinitionRow } from "@/lib/custom-field-validation";

export async function POST(req: Request) {
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

  if (updatePayload.vendor_normalized === undefined) {
    const { data: row } = await (supabase as any)
      .from("transactions")
      .select("vendor, vendor_normalized")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (row?.vendor != null && row?.vendor_normalized == null && String(row.vendor).trim()) {
      updatePayload.vendor_normalized = normalizeVendor(String(row.vendor));
    }
  }

  if (customFieldsPatch !== undefined && Object.keys(customFieldsPatch).length > 0) {
    const orgId = await getActiveOrgId(supabase, userId);
    if (!orgId) {
      return NextResponse.json({ error: "Active org required to edit custom fields" }, { status: 400 });
    }
    const keys = Object.keys(customFieldsPatch);
    if (keys.length > 40) {
      return NextResponse.json({ error: "Too many custom field keys" }, { status: 400 });
    }
    for (const k of keys) {
      if (!uuidSchema.safeParse(k).success) {
        return NextResponse.json({ error: "Invalid custom field key" }, { status: 400 });
      }
    }
    const { data: txRow, error: txErr } = await (supabase as any)
      .from("transactions")
      .select("id,custom_fields")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (txErr || !txRow) {
      return NextResponse.json(
        { error: safeErrorMessage(txErr?.message, "Transaction not found") },
        { status: 404 }
      );
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

    const merged = mergeCustomFieldsPatch(existing, customFieldsPatch, map);
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

  const { error } = await (supabase as any)
    .from("transactions")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to update transaction") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
