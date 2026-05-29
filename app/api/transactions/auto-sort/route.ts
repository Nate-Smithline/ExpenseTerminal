import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { applyAutoSortForVendor } from "@/lib/auto-sort";
import { safeErrorMessage } from "@/lib/api/safe-error";

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  const body = (await req.json()) as {
    vendorNormalized: string;
    quickLabel: string;
    businessPurpose: string;
    category?: string;
    schedule_c_line?: string | null;
    taxYear?: number | null;
    transactionType?: "income" | "expense";
  };

  const { vendorNormalized, quickLabel } = body;

  if (!vendorNormalized || !quickLabel) {
    return NextResponse.json(
      { error: "vendorNormalized and quickLabel required" },
      { status: 400 },
    );
  }

  try {
    const result = await applyAutoSortForVendor(supabase, userId, {
      vendorNormalized: body.vendorNormalized,
      quickLabel: body.quickLabel,
      businessPurpose: body.businessPurpose,
      category: body.category,
      schedule_c_line: body.schedule_c_line,
      taxYear: body.taxYear,
      transactionType: body.transactionType ?? "expense",
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auto-sort failed";
    return NextResponse.json(
      { error: safeErrorMessage(message, "Auto-sort failed") },
      { status: 500 },
    );
  }
}
