import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendSignupNotificationEmail } from "@/lib/email/send-signup-notification";
import { rateLimitByIp } from "@/lib/middleware/rate-limit";
import { isValidEmail } from "@/lib/validation/email";

const SIGNUP_NOTIFY_WINDOW_MS = 30 * 60 * 1000;

type NotifySignupBody = {
  email?: string;
  userId?: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
};

/**
 * POST /api/email/notify-signup
 * Sends an internal alert when a new client creates an account.
 * Called from the signup page immediately after signUp succeeds.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    const { success: rateLimitOk } = await rateLimitByIp(req, {
      limit: 10,
      keyPrefix: "notify-signup",
    });
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }
  }

  let body: NotifySignupBody;
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
  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(userId);

  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const authEmail = (authData.user.email ?? "").trim().toLowerCase();
  if (authEmail !== email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Email does not match this account." },
      { status: 400 }
    );
  }

  if (authData.user.app_metadata?.signup_admin_notified) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const createdAt = authData.user.created_at
    ? new Date(authData.user.created_at)
    : null;
  if (
    !createdAt ||
    Date.now() - createdAt.getTime() > SIGNUP_NOTIFY_WINDOW_MS
  ) {
    return NextResponse.json({ error: "Signup window expired" }, { status: 400 });
  }

  const firstName =
    body.first_name?.trim() ||
    (authData.user.user_metadata?.first_name as string | undefined)?.trim() ||
    "";
  const lastName =
    body.last_name?.trim() ||
    (authData.user.user_metadata?.last_name as string | undefined)?.trim() ||
    "";
  const phone =
    body.phone?.trim() ||
    (authData.user.user_metadata?.phone_us as string | undefined)?.trim() ||
    null;

  try {
    await sendSignupNotificationEmail({
      firstName,
      lastName,
      email: authData.user.email ?? email,
      phone,
      signedUpAt: createdAt.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
      }),
    });
  } catch (err) {
    console.error("notify-signup: failed to send admin email", {
      email,
      userId,
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }

  try {
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...authData.user.app_metadata,
        signup_admin_notified: true,
      },
    });
  } catch (err) {
    console.error("notify-signup: failed to mark user as notified", {
      userId,
      error: err,
    });
  }

  return NextResponse.json({ ok: true });
}
