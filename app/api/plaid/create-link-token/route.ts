export { POST } from "@/app/api/data-sources/plaid/create-link-token/route";

import { NextResponse } from "next/server";
import { Products, CountryCode } from "plaid";
import { getPlaidClient } from "@/lib/plaid/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const client = getPlaidClient(host);
  if (!client) {
    return NextResponse.json(
      { error: "plaid not configured" },
      { status: 503 }
    );
  }
  const res = await client.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: "ExpenseTerminal",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return NextResponse.json({ link_token: res.data.link_token });
}
