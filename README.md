## LedgerTerminal Monorepo

SaaS for helping solopreneurs and small orgs manage budgets, calculate tax deductions, and (eventually) handle expense management.

This repo is a **pnpm + turborepo monorepo** with:

- **`apps/backend`**: NestJS + GraphQL API (MongoDB, Redis, Stripe, SendGrid, OAuth-ready)
- **`apps/frontend`**: Next.js app for the marketing/dashboard UI
- **`packages/*`**: Reserved for shared libraries (types, UI, domain logic) as you grow

---

## 1. Local Dev Prereqs (macOS)

- **Node.js**: Install via `nvm` (recommended)
- **pnpm**: `npm install -g pnpm`
- **Git**: via Xcode CLT or Homebrew

```bash
brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc
nvm install --lts
npm install -g pnpm
```

Clone your repo and install dependencies:

```bash
cd /Users/nathansmith/Desktop/ledgerterminal/LedgerTerminal
pnpm install
```

Run everything in dev:

```bash
pnpm dev         # runs backend + frontend via turbo
```

Backend will default to **`http://localhost:4000/graphql`**, frontend to **`http://localhost:3000`** (once you add the standard Next.js `app` bootstrap files).

---

## 2. MongoDB Atlas Setup (Primary DB)

This is the most critical step for day one.

- **Host**: MongoDB Atlas (free tier, 512MB)
- **Usage**: primary data store for users, budgets, transactions, tax profiles, etc.

### 2.1. Create a free MongoDB Atlas cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account.
2. Create a **new project** (e.g. `LedgerTerminal`).
3. Click **Build a Database**:
   - Choose **Free tier** (`M0`).
   - Choose a region close to your Railway region (e.g. `us-east-1`).
4. Create a **database user**:
   - Username: e.g. `ledgeradmin`
   - Password: generate and store in 1Password/Bitwarden.
5. Go to **Network Access** and allow:
   - Your IP (for local dev), or
   - `0.0.0.0/0` temporarily while developing (lock this down later).

### 2.2. Get your MongoDB connection string

In Atlas:

1. Click **Connect** → **Drivers**.
2. Copy the connection URI, it will look like:

```text
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ledgerterminal?retryWrites=true&w=majority
```

3. Replace `<username>`, `<password>`, and `<cluster>` with your actual values.

### 2.3. Wire Mongo into the backend

The backend uses `@nestjs/mongoose` and expects a `MONGODB_URI` env variable.

Create a local env file for the backend (in your real environment; `.env` files are intentionally not committed here):

```bash
cd /Users/nathansmith/Desktop/ledgerterminal/LedgerTerminal/apps/backend
touch .env.local
```

Add:

```text
MONGODB_URI=mongodb+srv://ledgeradmin:<password>@<cluster>.mongodb.net/ledgerterminal?retryWrites=true&w=majority
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
```

Then start the backend:

```bash
cd /Users/nathansmith/Desktop/ledgerterminal/LedgerTerminal
pnpm dev
```

Visit `http://localhost:4000/graphql` and run:

```graphql
query {
  health
}
```

You should get `"ok"` back, confirming Nest + GraphQL + Mongo bootstrapping is working (even before you define models).

---

## 3. Redis (Caching / Queues)

You can use **Railway Redis** plugin or **Upstash**.

### 3.1. Upstash (simple, free)

1. Go to [Upstash](https://upstash.com/) → sign up.
2. Create a **Redis database** in a US region.
3. Copy the **REST URL** or **Redis URL**, e.g.:

```text
redis://default:<password>@<host>:<port>
```

4. In your backend environment (e.g. Railway or `.env.local` for local dev), set:

```text
REDIS_URL=redis://default:<password>@<host>:<port>
```

In code, you will connect via `ioredis` using `process.env.REDIS_URL` when you start adding caching/queue features.

---

## 4. Cloudflare R2 (File Storage)

Used later for receipts, invoices, and document uploads.

1. In Cloudflare dashboard, create an **R2 bucket** (e.g. `ledgerterminal-files`).
2. Create an **API token** with R2 read/write for that bucket.
3. Note the:
   - Account ID
   - Access key ID
   - Secret access key
   - Bucket name
   - Public endpoint
4. Plan to store in backend env:

```text
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=ledgerterminal-files
R2_PUBLIC_URL=https://<your-bucket>.<region>.r2.cloudflarestorage.com
```

You’ll wire this in later when you implement file upload flows.

---

## 5. Stripe (Payments)

- **Provider**: Stripe
- **Cost**: 2.9% + $0.30 per successful charge
- **Pattern**: Webhook-based billing events

### 5.1. Stripe setup

1. Create a Stripe account at `https://dashboard.stripe.com`.
2. In **Developers → API keys**, grab:
   - `STRIPE_SECRET_KEY`
3. In **Developers → Webhooks**, create a webhook endpoint:
   - For local dev: use the Stripe CLI:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:4000/webhooks/stripe
```

4. Copy the webhook signing secret (`whsec_...`) into:

```text
STRIPE_WEBHOOK_SECRET=whsec_...
```

Once you build the webhook handler in Nest, you’ll use these env vars to verify events and drive your billing logic (subscriptions, invoices, refunds, etc.).

---

## 6. SendGrid (Transactional Email)

1. Create a SendGrid account at `https://sendgrid.com`.
2. Verify your sender email (e.g. `noreply@yourdomain.com`).
3. Go to **Settings → API Keys** and create a **Restricted** key for mail send.
4. Store in backend env:

```text
SENDGRID_API_KEY=SG.xxxxx
```

In code you’ll use `@sendgrid/mail` with `SENDGRID_API_KEY` to send signup confirmations, invoice emails, etc.

---

## 7. Authentication, OAuth, and reCAPTCHA

### 7.1. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (e.g. `LedgerTerminal`).
3. Enable **Google+ API / People API** and **OAuth consent screen**.
4. Create an **OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs (for local dev), e.g.:

```text
http://localhost:4000/auth/google/callback
```

5. Store:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

You’ll wire these into NestJS Passport strategies (`passport-google-oauth20`).

### 7.2. Apple Sign-In

Apple requires more configuration (Apple Developer account):

1. Create a **Services ID**.
2. Configure redirect URL (e.g. `https://api.yourdomain.com/auth/apple/callback`).
3. Create a private key for Sign in with Apple.
4. Store:

```text
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
```

You’ll integrate with `passport-apple` in Nest when ready.

### 7.3. Google reCAPTCHA (anti-spam)

1. Go to [Google reCAPTCHA](https://www.google.com/recaptcha/admin/create).
2. Create a site for your domain:
   - Type: v3 or v2 (challenge-based).
3. Store:

```text
RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
```

Frontend uses `RECAPTCHA_SITE_KEY`, backend validates with `RECAPTCHA_SECRET_KEY`.

---

## 8. Analytics & Monitoring

You can start with:

- **Plausible** or **Simple Analytics** for privacy-first analytics.
- Or **Google Analytics** for free but heavier tracking.

Implementation (later):

- Add their script to your Next.js frontend.
- Track key events: signup, onboarding completion, subscription upgrade, churn.

---

## 9. Running in Production (Railway + Caddy + Cloudflare)

### 9.1. Railway

1. Create a project in Railway.
2. Deploy:
   - **Backend**: Dockerfile or Node environment pointing at `apps/backend`.
   - **Frontend**: Dockerfile or Node environment pointing at `apps/frontend`.
3. Configure env vars in Railway:
   - `MONGODB_URI`, `REDIS_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, OAuth keys, etc.

### 9.2. Domain & DNS (GoDaddy + Cloudflare + Caddy)

1. Register your domain at GoDaddy.
2. Point nameservers to **Cloudflare**.
3. In Cloudflare:
   - Create DNS records for `api.yourdomain.com` (backend) and `app.yourdomain.com` (frontend), pointing to your Caddy/Railway endpoint.
4. On your server (where Caddy runs):
   - Configure Caddy with automatic HTTPS using Let’s Encrypt.
   - Proxy `api.yourdomain.com` → Railway backend.
   - Proxy `app.yourdomain.com` → Railway frontend.

---

## 10. Where to Start Coding

- **Backend** (`apps/backend`):
  - Add GraphQL modules for `User`, `Budget`, `Transaction`, and `TaxProfile`.
  - Add Mongoose schemas and services to talk to MongoDB.
  - Implement Stripe webhook handler and SendGrid mailer service.
- **Frontend** (`apps/frontend`):
  - Build basic onboarding flow (connect Google, enter business profile, create first budget).
  - Use GraphQL client (Apollo/urql) to talk to the backend.

When you’re ready, I can help you design the first concrete data models (e.g. budgets, tax categories, expense rules) and wire them end-to-end from GraphQL to Mongo and back to the UI.

