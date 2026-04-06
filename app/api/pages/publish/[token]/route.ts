import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimitByIp, publishedPageApiLimit } from "@/lib/middleware/rate-limit";
import { fetchPublishedPageBundle } from "@/lib/published-page-resolve";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const rl = await rateLimitByIp(req, publishedPageApiLimit);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { token } = await ctx.params;
    const svc = createSupabaseServiceClient();
    const bundle = await fetchPublishedPageBundle(svc, token);
    if (!bundle) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      page: bundle.page,
      view: bundle.view,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load" },
      { status: 500 }
    );
  }
}
