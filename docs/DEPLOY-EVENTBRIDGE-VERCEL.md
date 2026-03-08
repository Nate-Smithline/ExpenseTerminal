# Going Live: EventBridge & Vercel Checklist

Use this list to deploy ExpenseTerminal with cron jobs (Stripe import + notification reminders) on Vercel and, optionally, AWS EventBridge.

---

## 1. Vercel project & env vars

- [ ] Create (or link) the Vercel project and connect the repo.
- [ ] Set **Environment Variables** in Vercel (Settings → Environment Variables). Use **Production** (and optionally Preview) for each.

### Required for app + cron

| Variable | Description | Example / note |
|----------|-------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | From Supabase → Settings → API |
| `SUPABASE_SECRET_KEY` | Supabase service role key | Needed for cron (bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | Production app URL | `https://expenseterminal.com` (no trailing slash) |
| `CRON_SECRET` | Secret for securing cron endpoints (min 16 chars) | e.g. `openssl rand -hex 24` — **set in Vercel only** |
| `RESEND_API_KEY` | Resend API key | For reminder + other emails |
| `EMAIL_FROM_ADDRESS` | From email | `hello@expenseterminal.com` |
| `EMAIL_FROM_NAME` | From name | `Nate from ExpenseTerminal` |

### Stripe (production)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Live secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret for your production endpoint |
| `STRIPE_PLUS_PRODUCT_ID` | Pro product ID (live) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live publishable key (`pk_live_...`) |

(Add `STRIPE_STARTER_PRODUCT_ID` if you still use Starter.)

### Optional but recommended

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | For AI categorization |
| `STRIPE_MODE` | Set to `live` in production (or omit; default is live when not `test`) |

- [ ] **Do not** set Stripe test keys or `STRIPE_MODE=test` for production.
- [ ] Redeploy after changing env vars so cron and API routes use them.

---

## 2. Vercel Cron (recommended)

The repo includes a `vercel.json` that defines two cron jobs, both at **07:00 UTC** (2:00 AM EST):

1. **`/api/cron/stripe-import`** — Syncs new transactions for all Stripe (Direct Feed) data sources.
2. **`/api/cron/notifications`** — Sends unsorted-reminder emails based on `notification_preferences`.

- [ ] Ensure `vercel.json` is committed and deployed (it’s in the repo).
- [ ] Set `CRON_SECRET` in Vercel (Production). Vercel sends it as `Authorization: Bearer <CRON_SECRET>` when invoking cron paths.
- [ ] In Vercel: **Settings → Cron Jobs** — confirm both jobs appear and are enabled.
- [ ] Cron runs only on **production** deployments, not previews.

To use a different schedule, edit the `schedule` field in `vercel.json` (e.g. `0 7 * * *` = 07:00 UTC daily). Redeploy after changes.

---

## 3. AWS EventBridge (optional alternative)

If you prefer EventBridge (or another scheduler) instead of Vercel Cron:

- [ ] Create two EventBridge rules (e.g. one per job) with schedule **cron(0 7 * * ? *)** (07:00 UTC daily).
- [ ] Set the target to **HTTP** (or API Gateway) pointing at:
  - `https://<your-vercel-domain>/api/cron/stripe-import`
  - `https://<your-vercel-domain>/api/cron/notifications`
- [ ] Configure the request to send:
  - **Method:** GET (or POST if you change the routes).
  - **Header:** `Authorization: Bearer <CRON_SECRET>` (same value as in Vercel).
- [ ] Ensure the EventBridge execution role / network can reach your Vercel URL.

If you use **only** EventBridge, you can remove or disable the `crons` in `vercel.json` so Vercel doesn’t run them.

---

## 4. Stripe webhook (production)

- [ ] In Stripe Dashboard (Live): **Developers → Webhooks** → Add endpoint.
- [ ] URL: `https://<your-vercel-domain>/api/billing/webhook` (or your actual webhook path).
- [ ] Select the events you need (e.g. `checkout.session.completed`, `customer.subscription.*`).
- [ ] Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET` in Vercel.

---

## 5. Resend domain

- [ ] In Resend: verify the domain used in `EMAIL_FROM_ADDRESS` (e.g. `expenseterminal.com`) so reminder and other emails send successfully.

---

## 6. Database

- [ ] Run all Supabase migrations (or apply schema) so tables such as `notification_preferences`, `data_sources` (with `stripe_sync_start_date` if used), etc. exist in production.
- [ ] Confirm production Supabase URL and keys match the env vars in Vercel.

---

## 7. Post-deploy checks

- [ ] Open `https://<your-domain>/api/cron/stripe-import` in a browser (or with curl). You should get **401 Unauthorized** (no Bearer token). That confirms the route is deployed and protected.
- [ ] Call with auth:  
  `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://<your-domain>/api/cron/stripe-import`  
  You should get a JSON response (e.g. `{ ok: true, results: [...] }`).
- [ ] Same for `/api/cron/notifications`: 401 without token, 200 + JSON with valid `Authorization: Bearer <CRON_SECRET>`.
- [ ] Trigger a test Stripe webhook (or complete a test checkout) and confirm the app behaves as expected.
- [ ] Optionally create a test user with `notification_preferences` and wait for the next cron run (or trigger the notifications cron manually) to confirm reminder emails send.

---

## Quick reference: cron endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /api/cron/stripe-import` | Sync Stripe data sources | `Authorization: Bearer CRON_SECRET` |
| `GET /api/cron/notifications` | Send unsorted reminders | `Authorization: Bearer CRON_SECRET` |

Both run at **2:00 AM EST** (07:00 UTC) when using the default `vercel.json` crons.
