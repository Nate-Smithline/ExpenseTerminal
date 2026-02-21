import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { TAX_YEAR_MIN, TAX_YEAR_MAX } from "@/lib/tax-year-cookie";

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return Response.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { tax_year?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = body.tax_year;
  const year =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
  if (Number.isNaN(year) || year < TAX_YEAR_MIN || year > TAX_YEAR_MAX) {
    return Response.json(
      { error: `tax_year must be ${TAX_YEAR_MIN}–${TAX_YEAR_MAX}` },
      { status: 400 }
    );
  }

  const supabase = authClient;
  const { data: profile, error: fetchError } = await (supabase as any)
    .from("profiles")
    .select("onboarding_progress")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    return Response.json(
      { error: safeErrorMessage(fetchError?.message, "Failed to load profile") },
      { status: 500 }
    );
  }

  const progress =
    profile.onboarding_progress && typeof profile.onboarding_progress === "object"
      ? { ...profile.onboarding_progress }
      : {};
  progress.selected_tax_year = year;

  const { error: updateError } = await (supabase as any)
    .from("profiles")
    .update({
      onboarding_progress: progress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    return Response.json(
      { error: safeErrorMessage(updateError.message, "Failed to save tax year") },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, tax_year: year });
}
