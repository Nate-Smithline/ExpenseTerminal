import { NextResponse } from "next/server";
import { rateLimitByIdentifier, passwordResetLimit } from "@/lib/middleware/rate-limit";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/verification-tokens";
import { validatePassword } from "@/lib/validation/password";

type ResetBody = {
  token?: string;
  password?: string;
};

/**
 * POST /api/auth/reset-password
 * Body: { token: string, password: string }
 * Validates a one-time reset token, updates the user's password via
 * Supabase Admin, and marks the token as used.
 */
export async function POST(req: Request) {
  let body: ResetBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawToken = body.token?.trim() ?? "";
  const token = rawToken
    ? rawToken.toLowerCase().replace(/\s+/g, "-")
    : "";
  const password = body.password ?? "";

  if (!token) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json(
      { error: passwordCheck.message ?? "Password does not meet requirements." },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(token);

  const { success } = await rateLimitByIdentifier(tokenHash, passwordResetLimit);
  if (!success) {
    return NextResponse.json(
      { error: "Too many reset attempts. Try again in an hour." },
      { status: 429 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: resetRow, error } = await (supabase as any)
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .maybeSingle();

  if (error || !resetRow) {
    return NextResponse.json(
      { error: "Invalid or expired reset code. Please request a new one." },
      { status: 400 }
    );
  }

  if (new Date(resetRow.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired reset code. Please request a new one." },
      { status: 400 }
    );
  }

  const userId = resetRow.user_id as string;

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (updateError) {
    console.error("Failed to update password for user", userId, updateError);
    return NextResponse.json(
      { error: "Could not update password. Please try again." },
      { status: 500 }
    );
  }

  await (supabase as any)
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", resetRow.id);

  return NextResponse.json({ ok: true });
}

