import {
  createSupabaseRouteClient,
} from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { taxYearSettingsPostSchema } from "@/lib/validation/schemas";

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
  const taxYear = url.searchParams.get("tax_year");

  const cols = "id,user_id,tax_year,tax_rate,expected_income_range,created_at";
  let query = (supabase as any)
    .from("tax_year_settings")
    .select(cols)
    .eq("user_id", userId)
    .order("tax_year", { ascending: false });

  if (taxYear) {
    query = query.eq("tax_year", parseInt(taxYear, 10));
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error.message, "Failed to load tax year settings") }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: data ?? [] }), {
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
  const { success: rlOk2 } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk2) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  const parsed = taxYearSettingsPostSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  const { tax_year, tax_rate, expected_income_range } = parsed.data;

  const cols = "id,user_id,tax_year,tax_rate,expected_income_range,created_at";
  const { data, error } = await (supabase as any)
    .from("tax_year_settings")
    .upsert({
      user_id: userId,
      tax_year,
      tax_rate,
      expected_income_range: expected_income_range ?? null,
    }, { onConflict: "user_id,tax_year" })
    .select(cols)
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: safeErrorMessage(error.message, "Failed to save tax year settings") }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}
