# Stripe Financial Connections – backend setup

If **bank linking works but no transactions appear** after sync, check the following on the backend/Stripe side.

## 1. Financial Connections registration (live mode)

Stripe requires **completed Financial Connections registration** to access transactions in **live mode**.

- Open [Stripe Dashboard → Settings → Financial Connections](https://dashboard.stripe.com/settings/financial-connections).
- Complete the registration flow for your business.
- Test mode does not require this; transaction test data is always available.

## 2. API keys and mode

- **Live**: use `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (and product IDs without `_TEST`).
- **Test**: use `STRIPE_SECRET_KEY_TEST` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` (and `_TEST` product IDs).
- The app uses **test** keys on `localhost` and **live** keys on your production hostname. Ensure the keys in `.env` match the environment you’re testing in.

## 3. Return URL (HTTPS)

Financial Connections requires the callback URL to be **HTTPS**.

- Callback is: `{NEXT_PUBLIC_APP_URL or current origin}/api/data-sources/stripe/callback`.
- On localhost, either run with HTTPS (e.g. `next dev --experimental-https`) or set `NEXT_PUBLIC_APP_URL` to an HTTPS tunnel (e.g. ngrok). The connect route will try to force HTTPS for localhost when building `return_url`.

## 4. Debugging “no transactions”

- **Server logs**: In development, the sync runner logs when the transaction refresh succeeds and the first list response (count, `has_more`, date range). Check the terminal where `next dev` (or your server) runs.
- **Data source errors**: After a sync attempt, check the data source row: `last_error_summary` and `last_failed_sync_at`. These are shown in the UI and indicate refresh timeouts, “Transaction refresh failed”, or Stripe API errors (e.g. “Financial Connections not configured”).
- **Date range**: Transactions are filtered by `stripe_sync_start_date` (and optional end). If the range is too narrow or in the future, the list can be empty even when the refresh succeeded.

## 5. Optional: webhooks

For ongoing updates you can listen for `financial_connections.account.refreshed_transactions` and re-run sync for that account. The app can also rely on manual/cron sync without webhooks.
