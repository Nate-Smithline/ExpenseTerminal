export { POST } from "@/app/api/transactions/analyze/route";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { applyThresholds, classifyTransaction } from "@/lib/classifier/anthropic";

const b = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  const s = await createServerSupabase();
  const { data: u } = await s.auth.getUser();
  if (!u.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = b.parse(await request.json());
  const { data: t } = await s
    .from("transactions")
    .select("id, workspace_id, merchant_display, amount")
    .eq("id", id)
    .single();
  if (!t) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data: ws } = await s.from("workspaces").select("owner_id").eq("id", t.workspace_id).single();
  if (ws?.owner_id !== u.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data: p } = await s.from("profiles").select("work_profile").eq("id", u.user.id).single();
  const w = p?.work_profile as Record<string, unknown> | undefined;
  const res = await classifyTransaction({
    merchant: t.merchant_display || "Unknown",
    amount: Number(t.amount),
    accountLabel: "linked",
    workProfile: w ?? {},
  });
  const gate = applyThresholds(res.confidence);
  const status = gate === "auto" || gate === "flag" ? "auto_sorted" : "needs_review";
  await s
    .from("transactions")
    .update({
      schedule_c_line: res.schedule_c_line,
      category: res.category,
      is_business: res.is_business,
      confidence: res.confidence,
      status,
      ai_payload: { reasoning: res.reasoning, model: res.model, gate } as object,
    })
    .eq("id", id);
  return NextResponse.json({ result: res, status });
}
