/* eslint-disable @typescript-eslint/no-explicit-any -- storage + new columns */
import { NextResponse } from "next/server";
import {
  createSupabaseRouteClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { uuidSchema } from "@/lib/validation/schemas";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function sanitizeBaseName(name: string): string {
  const base = name.split("/").pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { id: transactionId } = await ctx.params;
  if (!uuidSchema.safeParse(transactionId).success) {
    return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
  }

  const formData = await req.formData();
  const propertyIdRaw = formData.get("propertyId");
  const file = formData.get("file");
  if (typeof propertyIdRaw !== "string" || !uuidSchema.safeParse(propertyIdRaw).success) {
    return NextResponse.json({ error: "Invalid propertyId" }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const supabase = authClient;
  const orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { data: tx, error: txErr } = await (supabase as any)
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (txErr || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const { data: def, error: defErr } = await (supabase as any)
    .from("transaction_property_definitions")
    .select("id,type")
    .eq("id", propertyIdRaw)
    .eq("org_id", orgId)
    .maybeSingle();
  if (defErr || !def || def.type !== "files") {
    return NextResponse.json({ error: "Invalid file property" }, { status: 400 });
  }

  const unique = crypto.randomUUID();
  const safeBase = sanitizeBaseName(file.name);
  const objectPath = `${userId}/${transactionId}/${unique}_${safeBase}`;

  const svc = createSupabaseServiceClient();
  const contentType = file.type?.trim() || "application/octet-stream";
  const { error: uploadError } = await (svc as any).storage
    .from("transaction-files")
    .upload(objectPath, file, { contentType, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: safeErrorMessage(uploadError.message, "Failed to upload file") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    file: {
      path: objectPath,
      name: file.name.slice(0, 500),
      mime: contentType.slice(0, 200),
      size: file.size,
    },
  });
}
