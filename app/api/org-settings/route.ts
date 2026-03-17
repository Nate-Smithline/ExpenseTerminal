import {
  createSupabaseRouteClient,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";

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

  const cols =
    "id,user_id,business_name,ein,business_address,business_address_line1,business_address_line2,business_city,business_state,business_zip,filing_type,created_at,updated_at";
  const { data, error } = await (supabase as any)
    .from("org_settings")
    .select(cols)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return new Response(JSON.stringify({ error: safeErrorMessage(error.message, "Failed to load settings") }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: data ?? null }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function PUT(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.userId;
  const { success: rlOkPut } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOkPut) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  let body: {
    business_name?: string;
    ein?: string;
    business_address?: string;
    business_address_line1?: string;
    business_address_line2?: string;
    business_city?: string;
    business_state?: string;
    business_zip?: string;
    filing_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const cols =
    "id,user_id,business_name,ein,business_address,business_address_line1,business_address_line2,business_city,business_state,business_zip,filing_type,created_at,updated_at";
  const { data, error } = await (supabase as any)
    .from("org_settings")
    .upsert({
      user_id: userId,
      business_name: body.business_name ?? null,
      ein: body.ein ?? null,
      business_address: body.business_address ?? null,
      business_address_line1: body.business_address_line1 ?? null,
      business_address_line2: body.business_address_line2 ?? null,
      business_city: body.business_city ?? null,
      business_state: body.business_state ?? null,
      business_zip: body.business_zip ?? null,
      filing_type: body.filing_type ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select(cols)
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error.message, "Failed to save settings") }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}
