import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "../types/database";

// Client-side helper explicitly uses the Supabase "publishable" key,
// so we don't rely on the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY name.
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase client is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createClientComponentClient<Database>({
    supabaseUrl,
    supabaseKey,
  });
}




