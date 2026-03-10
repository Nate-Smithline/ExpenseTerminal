import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation/email";

type BootstrapProfileBody = {
  email?: string;
  userId?: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  email_opt_in?: boolean;
  terms_accepted_at?: string | null;
};

/**
 * POST /api/auth/bootstrap-profile
 * Called immediately after signUp to create/update the profile row with the
 * user's email and signup data. Uses service role so it works before the
 * user has a confirmed session. Validates that userId exists in auth and
 * matches the given email to prevent abuse.
 */
export async function POST(req: Request) {
  let body: BootstrapProfileBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const userId = body.userId?.trim() ?? "";

  if (!email || !userId) {
    return NextResponse.json(
      { error: "Email and userId are required" },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Verify this userId exists in auth and belongs to this email
  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(userId);

  if (authError || !authData?.user) {
    console.error("bootstrap-profile: auth user not found", { userId, authError });
    return NextResponse.json(
      { error: "Invalid user. Please complete signup again." },
      { status: 400 }
    );
  }

  const authEmail = (authData.user.email ?? "").trim().toLowerCase();
  if (authEmail !== email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Email does not match this account." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const payload = {
    id: userId,
    email: authData.user.email ?? email,
    first_name: body.first_name?.trim() || null,
    last_name: body.last_name?.trim() || null,
    phone: body.phone?.trim() || null,
    email_opt_in: body.email_opt_in ?? true,
    terms_accepted_at: body.terms_accepted_at || null,
    updated_at: now,
  };

  const { error: upsertError } = await (supabase as any)
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (upsertError) {
    console.error("bootstrap-profile: failed to upsert profile", {
      userId,
      email,
      error: upsertError,
    });
    return NextResponse.json(
      { error: "Failed to create profile. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
