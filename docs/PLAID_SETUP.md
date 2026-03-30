# Plaid – Bank Linking & Transaction Import Setup

## 1. Create a Plaid account

- Sign up at [dashboard.plaid.com](https://dashboard.plaid.com).
- You'll get a **Client ID** and **Secret** for each environment (sandbox, development, production).

## 2. Environment variables

Add these to `.env.local` (and your deployment host):

```sh
PLAID_CLIENT_ID="your_client_id"
PLAID_SECRET="your_secret"
PLAID_ENV="sandbox"                    # sandbox | development | production
PLAID_ACCESS_TOKEN_SECRET="random-32-char-secret"  # encrypts access tokens at rest
PLAID_WEBHOOK_URL="https://your-domain.com/api/webhooks/plaid"  # optional, for production
```

- **Sandbox** provides test credentials and instant transactions — great for development.
- **Development** connects to real banks but has limited accounts (100 Items).
- **Production** requires a Plaid production access request.

## 3. How it works

1. Client calls `POST /api/data-sources/plaid/create-link-token` to get a Plaid Link token.
2. Plaid Link UI opens — user selects their bank and logs in.
3. On success, client sends the public token to `POST /api/data-sources/plaid/exchange-token`.
4. Server exchanges for a permanent access token (encrypted and stored in `data_sources`).
5. An initial `/transactions/sync` pulls up to 24 months of history.
6. Daily cron (`/api/cron/transaction-import`) runs incremental syncs using the stored cursor.

## 4. Transaction history

Plaid's `/transactions/sync` provides up to **24 months** of transaction history for depository and credit accounts. This is automatically requested via `days_requested: 730` in the Link token.

The initial sync may take a few minutes for the historical backfill to complete. Plaid sends a `TRANSACTIONS.HISTORICAL_UPDATE` webhook when done.

## 5. Webhooks (recommended for production)

Set `PLAID_WEBHOOK_URL` to receive real-time updates:

- **`TRANSACTIONS.SYNC_UPDATES_AVAILABLE`** — triggers an incremental sync.
- **`TRANSACTIONS.HISTORICAL_UPDATE`** — logged when 24-month backfill completes.
- **`ITEM.ERROR`** — marks the data source as needing repair (e.g., login expired).

The webhook endpoint is at `/api/webhooks/plaid`.

## 6. Debugging "no transactions"

- **Sandbox**: Use Plaid's test credentials (`user_good` / `pass_good`). Transactions appear immediately.
- **Server logs**: The sync runner logs diagnostics including added/modified/removed counts.
- **Data source errors**: Check `last_error_summary` on the data source row (shown in the UI).
- **Cursor**: The `plaid_cursor` column tracks sync progress. Set it to `null` to re-sync from scratch.

## 7. Stripe billing

Stripe is still used for billing (subscriptions, checkout, portal). The `stripe` npm package and `lib/stripe.ts` remain for that purpose. Only the bank-linking/transaction-pulling functionality uses Plaid.
