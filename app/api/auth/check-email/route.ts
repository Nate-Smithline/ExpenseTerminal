import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation/email";

type CheckEmailBody = {
  email?: string;
  intent?: "signup" | "login";
};

/**
 * POST /api/auth/check-email
 * Body: { email: string, intent?: "signup" | "login" }
 * Returns { exists: boolean } based on whether a profile exists for the email.
 */
export async function POST(req: Request) {
  let body: CheckEmailBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // First, try to find a matching profile row (case-insensitive) by email.
  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (profileError) {
    console.error("check-email: failed to query profiles", profileError);
  }

  let exists = !!profile?.id;

  // If no profile row, fall back to Supabase Auth users so we don't
  // incorrectly tell the user "no account" just because a profile is missing.
  if (!exists) {
    try {
      const { data: authUser, error: authError } = await (supabase as any)
        .from("auth.users")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();

      if (authError) {
        console.error("check-email: failed to query auth.users", authError);
      } else if (authUser?.id) {
        exists = true;
      }
    } catch (authErr) {
      console.error("check-email: unexpected error querying auth.users", authErr);
    }
  }

  return NextResponse.json({ exists });
}

