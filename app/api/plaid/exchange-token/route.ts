export { POST } from "@/app/api/data-sources/plaid/exchange-token/route";

import { NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid/client";
import { createServerSupabase } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { public_token } = (await request.json()) as { public_token?: string };
  if (!public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const client = getPlaidClient(host);
  if (!client) {
    return NextResponse.json({ error: "plaid not configured" }, { status: 503 });
  }
  const ex = await client.itemPublicTokenExchange({ public_token });
  const access = ex.data.access_token;
  const item = ex.data.item_id;
  const { data: w } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();
  if (!w) {
    return NextResponse.json({ error: "no workspace" }, { status: 400 });
  }
  const { error } = await supabase.from("data_sources").insert({
    workspace_id: w.id,
    plaid_item_id: item,
    access_token: access,
    institution_name: "Connected account",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item_id: item });
}
