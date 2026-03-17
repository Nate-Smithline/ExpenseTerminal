import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { validatePassword } from "@/lib/validation/password";
import { rateLimitByIp, passwordChangeLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return Response.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  const { success: rateLimitOk } = await rateLimitByIp(req, passwordChangeLimit);
  if (!rateLimitOk) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let body: { currentPassword?: string; password: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.currentPassword) {
    return Response.json(
      { error: "Current password is required" },
      { status: 400 }
    );
  }
  if (!body.password) {
    return Response.json({ error: "New password is required" }, { status: 400 });
  }
  const passwordCheck = validatePassword(body.password);
  if (!passwordCheck.valid) {
    return Response.json(
      { error: passwordCheck.message ?? "Password does not meet requirements" },
      { status: 400 }
    );
  }

  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) {
    return Response.json({ error: "User not found" }, { status: 401 });
  }

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: user.email,
    password: body.currentPassword,
  });
  if (signInError) {
    return Response.json(
      { error: "Current password is incorrect" },
      { status: 401 }
    );
  }

  const { error } = await authClient.auth.updateUser({
    password: body.password,
  });

  if (error) {
    return Response.json({ error: safeErrorMessage(error.message, "Failed to update password") }, { status: 500 });
  }

  // Record password change timestamp on profile
  const { error: profileError } = await (authClient as any)
    .from("profiles")
    .update({ password_changed_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) {
    // Don't block password change on this, but surface a generic warning
    return Response.json({ ok: true, warning: "Password changed, but could not record timestamp." });
  }

  return Response.json({ ok: true });
}
