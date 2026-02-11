import { cookies } from "next/headers";
import {
  createRouteHandlerClient,
  createServerComponentClient,
} from "@supabase/auth-helpers-nextjs";
import type { Database } from "../types/database";

function getSupabaseKeys() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer secret key server-side if provided, fall back to publishable key.
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase server client is missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return { supabaseUrl, supabaseKey };
}

export function createSupabaseRouteClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseKeys();
  return createRouteHandlerClient<Database>({ cookies, supabaseUrl, supabaseKey });
}

export function createSupabaseServerClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseKeys();
  return createServerComponentClient<Database>({ cookies, supabaseUrl, supabaseKey });
}


