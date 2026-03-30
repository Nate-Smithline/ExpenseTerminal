import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";

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

  const { searchParams } = new URL(req.url);
  const taxYear = parseInt(searchParams.get("tax_year") || String(new Date().getFullYear()), 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (authClient as any)
    .from("tax_filing_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ overrides: data ?? [] });
}

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

  const body = await req.json();
  const { tax_year, form_type, line_key, original_value, override_value } = body;

  if (!tax_year || !form_type || !line_key || override_value == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (authClient as any)
    .from("tax_filing_overrides")
    .upsert(
      {
        user_id: userId,
        tax_year,
        form_type,
        line_key,
        original_value: original_value ?? null,
        override_value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tax_year,form_type,line_key" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ override: data });
}
