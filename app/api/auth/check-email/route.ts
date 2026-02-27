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

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("check-email: failed to query profiles", error);
    return NextResponse.json(
      { error: "Failed to check account. Please try again." },
      { status: 500 }
    );
  }

  const exists = !!data?.id;

  return NextResponse.json({ exists });
}

