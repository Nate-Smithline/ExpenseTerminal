import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase server client is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // Use "lax" so the session cookie is sent when Stripe/Finicity redirects the user
          // back to our callback (cross-site top-level GET). "strict" would drop the cookie
          // and the callback would see the user as logged out (307 to /login, no sync).
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, sameSite: "lax" })
          );
        } catch {
          // Ignore if cookies cannot be set from this context.
        }
      },
    },
  });
}

/**
 * Service-role client that bypasses RLS.
 * Use only for server-side operations that don't use the user's session (e.g. send-verification email).
 */
export function createSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY"
    );
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// For Route Handlers (API routes)
export async function createSupabaseRouteClient() {
  return getServerSupabaseClient();
}

// For Server Components / pages
export async function createSupabaseServerClient() {
  return getServerSupabaseClient();
}

