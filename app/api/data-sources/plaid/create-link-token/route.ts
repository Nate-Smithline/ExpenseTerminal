import { NextResponse } from "next/server";
import type { LinkTokenCreateRequest } from "plaid";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { getPlaidClient, getPlaidEnv, PlaidProducts, PlaidCountryCode } from "@/lib/plaid";

function getRequestHostname(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const raw = (xfHost ?? host ?? "").split(",")[0]?.trim();
  if (raw) return raw.split(":")[0] ?? raw;
  return new URL(req.url).hostname;
}

/**
 * Create a Plaid Link token so the client can open the Plaid Link UI.
 * Requests 24 months of transaction history.
 */
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

  try {
    const hostname = getRequestHostname(req);
    const client = getPlaidClient(hostname);
    const env = getPlaidEnv(hostname);

    const webhookUrl = process.env.PLAID_WEBHOOK_URL || null;

    const request: LinkTokenCreateRequest = {
      user: { client_user_id: userId },
      client_name: "Expense Terminal",
      // Plaid does not allow initializing Balance explicitly; it is automatically
      // initialized when using other products like Transactions.
      products: [PlaidProducts.Transactions],
      transactions: {
        days_requested: 730,
      },
      country_codes: [PlaidCountryCode.Us],
      language: "en",
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
    };

    let response: Awaited<ReturnType<typeof client.linkTokenCreate>> | null = null;
    let balanceOptionalApplied = true;
    let balanceOptionalError: unknown = null;

    try {
      response = await client.linkTokenCreate(request);
    } catch (e) {
      balanceOptionalApplied = false;
      balanceOptionalError = e;
      throw e;
    }

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
      plaid_env: env,
      ...(process.env.NODE_ENV !== "production"
        ? {
            debug: {
              hostname,
              products: ["transactions"],
              balance_auto_initialized: true,
              balance_optional_applied: balanceOptionalApplied,
              balance_optional_error:
                !balanceOptionalApplied && balanceOptionalError
                  ? balanceOptionalError instanceof Error
                    ? balanceOptionalError.message
                    : String(balanceOptionalError)
                  : null,
            },
          }
        : {}),
    });
  } catch (e) {
    const err: any = e;
    const plaidData = err?.response?.data;
    const isPlaidHttpError = !!plaidData && typeof plaidData === "object";

    const message =
      (plaidData?.error_message as string | undefined) ||
      (err instanceof Error ? err.message : null) ||
      "Failed to create link token";

    const debug =
      process.env.NODE_ENV !== "production"
        ? {
            detail: err instanceof Error ? err.stack ?? err.message : String(err),
            plaid: isPlaidHttpError
              ? {
                  error_type: plaidData?.error_type,
                  error_code: plaidData?.error_code,
                  error_message: plaidData?.error_message,
                  display_message: plaidData?.display_message,
                  request_id: plaidData?.request_id,
                  suggested_action: plaidData?.suggested_action,
                }
              : null,
          }
        : undefined;

    console.error("[plaid/create-link-token]", message, isPlaidHttpError ? plaidData : undefined);
    return NextResponse.json(
      { error: message, ...(debug ? { debug } : {}) },
      { status: isPlaidHttpError ? 400 : 500 },
    );
  }
}
