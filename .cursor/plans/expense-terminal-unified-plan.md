# ExpenseTerminal Unified Plan (Rules, Automation, Pro Plan, Pricing)

## 1. Overview

- **Rules engine**: Extend `auto_sort_rules` into a general rules engine (conditions + actions) that supports vendor/description matching, optional data source conditions, and actions (auto‑categorize, exclude). Manage rules on a new Rules page and expose them via APIs usable from both UI and background jobs.
- **Automation**: Use the rules engine on import (CSV/manual now, Stripe Financial Connections via cron later) and for scheduled notifications (EventBridge + Resend, driven by a shared `notification_preferences` table).
- **Plans & billing**: Collapse to a single customer-facing paid plan **Pro** (internally still backed by existing “plus” product/plan, with Starter users silently grandfathered). Enforce clear Free limits and provide consistent, polished upgrade entry points (modal, billing page, sidebar, pricing page), all reusing the same Stripe Checkout flow.
- **UI surfaces**: Enhance Transactions, Data Sources, Rules, Billing, Sidebar, and Pricing pages to clearly surface sources, automation, limits, and upgrade paths, with a restrained, typographic aesthetic.

---

## 2. Domain & Database Model

### 2.1 Transactions & data sources (existing foundation)

- `transactions` table (existing):
  - Key fields: `id`, `user_id`, `date`, `vendor`, `description`, `amount`, `category`, `schedule_c_line`, `status`, `business_purpose`, `quick_label`, `notes`, `tax_year`, `source`, `transaction_type`, `data_source_id`, `eligible_for_ai`, timestamps.
  - `source` used as:
    - `"csv_upload"` for CSV/Excel imports (default).
    - `"manual"` for manually created transactions.
    - `"data_feed"` for live Stripe Financial Connections imports (future).
- `data_sources` table (extended):
  - Existing: `id`, `user_id`, `name`, `account_type`, `institution`, `transaction_count`, `created_at`.
  - To extend (see below).

### 2.2 Rules table: `auto_sort_rules`

- Existing columns:
  - `id`, `user_id`, `vendor_pattern`, `quick_label`, `business_purpose`, `category`, `created_at`.
- Extend (schema.sql):
  - `name TEXT`
  - `enabled BOOLEAN NOT NULL DEFAULT TRUE`
  - `conditions JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `action JSONB NOT NULL DEFAULT '{}'::jsonb`
- Purpose:
  - Support both legacy auto-sort rules and new generalized rules (conditions + actions) in a single table.

### 2.3 Notification preferences

- Single table shared by Rules page UI and Cron (schema.sql):
  - `notification_preferences`:
    - `user_id UUID PRIMARY KEY REFERENCES auth.users(id)`
    - `type TEXT CHECK (type IN ('count_based', 'interval_based'))`
    - `value TEXT NOT NULL`
      - `interval_based`: `'daily' | 'weekly' | 'monthly' | 'quarterly'`.
      - `count_based`: stringified positive integer threshold (`"10"`, `"100"`, `"500"`, `"1000"`, or a custom number).
    - `last_notified_at TIMESTAMPTZ` — used by the daily 2:00 AM EST cron to determine if the next notification is due.
    - Optional: `last_counter_reset_at TIMESTAMPTZ` — for count-based implementations that reset a baseline.
    - `created_at`, `updated_at` timestamps.

### 2.4 Data sources: manual vs Stripe (Financial Connections)

- Extend `data_sources` (schema.sql):
  - `source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'stripe'))`
  - Stripe-specific:
    - `stripe_account_id TEXT`
    - `financial_connections_account_id TEXT`
  - Lifecycle / sync metadata:
    - `connected_at TIMESTAMPTZ`
    - `last_successful_sync_at TIMESTAMPTZ`
    - `last_failed_sync_at TIMESTAMPTZ`
    - `last_error_summary TEXT`
  - Existing `transaction_count` reused as:
    - For Stripe sources: total transactions pulled.
    - For manual sources: can be `0` or ignored in UI.

- Guarantees:
  - Stripe sources (`source_type = 'stripe'`):
    - Store: account name (`name`), `stripe_account_id`, `connected_at`, `last_successful_sync_at`, `transaction_count`.
  - Manual sources (`source_type = 'manual'`):
    - Store: account name (`name`), `connected_at`.
    - `transaction_count` not displayed.

### 2.5 TS types & validation

- `lib/types/database.ts`:
  - Update `auto_sort_rules.Row/Insert/Update` with `name`, `enabled`, `conditions`, `action`.
  - Update `data_sources` types with `source_type`, Stripe IDs, and sync fields.
  - All changes typed so API handlers and UIs consume them safely.

- `lib/validation/schemas.ts`:
  - Extend `transactionUpdateBodySchema`:
    - `source: z.enum(["csv_upload", "manual"]).optional()`
  - Extend activity filters:
    - `activityViewFiltersSchema`: add `source?: "data_feed" | "csv_upload" | "manual" | null`.
  - Add rule schemas:
    - `ruleConditionSchema`, `ruleActionSchema`, `ruleCreateSchema`, `ruleUpdateSchema`.
  - Add notification preference schema for `/api/notification-preferences`.

---

## 3. Rules System & Rules Page

### 3.1 Rule JSON schema (shared types)

- Create `lib/rules/types.ts`:
  - `RuleConditions`:
    - `match: { field: "vendor_or_description"; pattern: string }`
      - Applied as case-insensitive `ILIKE` on `vendor` or `description`.
    - `source?: "csv_upload" | "manual" | "data_feed" | null`
      - When present, rule only matches that `transactions.source`.
      - `null` or omitted means source-agnostic.
  - `RuleAction`:
    - `{ type: "auto_categorize"; category?: string }`
    - `{ type: "exclude" }`

### 3.2 Rules engine module

- Create `lib/rules/engine.ts`:
  - `matchesRule(tx, conditions: RuleConditions): boolean`:
    - `vendor ILIKE %pattern% OR description ILIKE %pattern%`.
    - If `conditions.source` is set, require `tx.source === conditions.source`.
  - `buildUpdateForAction(tx, action: RuleAction)`:
    - `auto_categorize`:
      - Returns partial transaction update (e.g. `category`, optionally status).
    - `exclude`:
      - Indicates that the transaction should be deleted.
  - `applyRulesToTransactions(supabase, userId, txIds: string[])`:
    - Load all enabled rules for the user.
    - For each transaction id:
      - Apply the first matching rule (or all, if we choose first-match semantics).
      - Accumulate updates and deletes.
    - Run batched `UPDATE`/`DELETE` statements on `transactions`.

- Legacy integration:
  - In `app/api/transactions/auto-sort/route.ts`:
    - Keep existing behavior (create `auto_sort_rules` record; update pending transactions).
    - Also populate `conditions`/`action` JSON fields to reflect:
      - `conditions`: `{ match: { field: "vendor_or_description", pattern: vendor_pattern }, source: null }`
      - `action`: `{ type: "auto_categorize", category: category || null }`

### 3.3 Rules API

- `app/api/rules/route.ts`:
  - `GET`:
    - Return all rules for current user from `auto_sort_rules`.
    - Map DB rows → DTO:
      - `{ id, name, enabled, conditions, action, created_at, legacySummary? }`.
  - `POST`:
    - Validate via `ruleCreateSchema`.
    - Insert into `auto_sort_rules` with `conditions`/`action`.
  - `PATCH`:
    - Validate via `ruleUpdateSchema`.
    - Update `name`, `enabled`, `conditions`, `action`.
  - `DELETE`:
    - Delete rule by id for the current user.

- `app/api/rules/apply/route.ts`:
  - `POST { ruleId, preview: true }`:
    - Compute `matchCount` using `RuleConditions` directly in SQL or via `matchesRule`.
    - Return `{ matchCount }`.
  - `POST { ruleId, preview: false }`:
    - Use `applyRulesToTransactions` to:
      - Update matching transactions (auto-categorize).
      - Delete matches (exclude).
    - Return counts of updated/deleted records.

### 3.4 Rules Page UI

- `app/rules/page.tsx`:
  - Server component:
    - Fetch rules (via Supabase or `/api/rules`).
    - Fetch notification preference.
    - Render `RulesPageClient`.

- `app/rules/RulesPageClient.tsx` (client):
  - Layout:
    - Top: **Notification Controls** (see 3.5).
    - Next: Rules list + “New rule” button.
  - Rules list:
    - Each rule card shows:
      - Name.
      - Condition summary:
        - e.g. “If vendor/description contains ‘UBER’” and optionally `“and source is Stripe/CSV/Manual”`.
      - Action summary:
        - “Then auto-categorize as Travel”.
        - Or “Then exclude (delete)”.
      - Enabled toggle.
      - Edit / Delete buttons.
  - Rule editor modal:
    - Fields:
      - Name (optional).
      - Condition:
        - “Merchant / description contains” text input (`pattern`).
        - Optional Data source dropdown: Any, Stripe, CSV, Manual.
      - Action:
        - Radio: Auto-categorize / Exclude.
        - If Auto-categorize:
          - Category select populated from `SCHEDULE_C_LINES` labels.
    - Save:
      - Calls `/api/rules` (POST/PATCH).
      - On success, opens Apply Scope modal (3.6).

### 3.5 Rules Page – Notification Controls

- At top of Rules page:
  - “Notification Controls” section:
    - Shows current preference in plain language:
      - Interval-based: “Notifications: Daily/Weekly/Monthly/Quarterly”.
      - Count-based: “Notifications: Every 100 transactions”.
    - If no preference:
      - Default to **Monthly** and display “Notifications: Monthly”.
    - Inline **Manage** button:
      - Opens Notification Controls modal.

- `NotificationControlsModal`:
  - Style:
    - Match Profile Settings modal (card layout, typography, spacing, backdrop).
  - Top toggles:
    - Two full-width buttons: “Time-Based” and “Number of Transactions”.
    - Only one active; switching tabs clears the other’s current selection in form state.
  - Initial tab:
    - If existing `type === 'interval_based'` → open Time-Based tab.
    - If `type === 'count_based'` → open Number of Transactions.
    - If no preference → default Time-Based with Monthly selected.
  - Descriptions:
    - Time-Based:
      - “We’ll remind you to sort your transactions on your chosen schedule, regardless of how many have come in.”
    - Number of Transactions:
      - “We’ll remind you once you’ve accumulated the selected number of unsorted transactions.”
  - Presets:
    - Time-Based:
      - Daily, Weekly, Monthly, Quarterly (radio list).
    - Count-Based:
      - Buttons for “Every 10”, “Every 100”, “Every 500”, “Every 1,000”.
      - Custom numeric input for a specific number.
  - Save:
    - Build preference:
      - `type: 'interval_based' | 'count_based'`.
      - `value: 'daily' | 'weekly' | 'monthly' | 'quarterly'` or a numeric string for count.
    - `PATCH /api/notification-preferences`.
    - Update the Rules page summary.
    - Close modal.
    - EventBridge / cron simply reads this table at 2:00 AM EST; any per-user EventBridge updates can be layered later.

### 3.6 Apply Scope (Going Forward vs Retroactive)

- Apply Scope modal (RulesPageClient):
  - After successful rule save:
    - Show options:
      - “Apply going forward only”.
      - “Apply retroactively to all existing transactions”.
  - Keyboard shortcuts:
    - `g` for going forward.
    - `r` for retroactive.
    - `Enter` for primary.
    - `Esc` to cancel.

- Retroactive flow:
  - Step 1: `/api/rules/apply` with `preview: true` → show `matchCount`.
  - If `matchCount` ≥ threshold (e.g. 100):
    - Show strong confirmation:
      - Especially for exclude: “This will permanently delete N transactions.”
  - Step 2: confirm → `/api/rules/apply` with `preview: false`.
    - Toast success: “Applied rule to N transactions.”

---

## 4. Transactions UI (Detail & List)

### 4.1 Transaction Detail – Data Source

- `components/TransactionDetailPanel.tsx`:
  - Replace simple `Source` row with `Data source` row:
    - For `source === "data_feed"`:
      - Text: `Live Data through Stripe`.
      - `Stripe` word:
        - Link to `https://stripe.com` in a new tab.
        - Styled with Stripe purple (`#635bff`, semibold).
      - Always read-only (regardless of `editable`).
    - For `source === "csv_upload"`:
      - “Uploaded via CSV”.
    - For `source === "manual"`:
      - “Entered manually”.
    - Null/unknown:
      - Treat as “Uploaded via CSV” fallback.

  - When `editable` and `source` is `"csv_upload"` or `"manual"`:
    - Show a dropdown:
      - “Uploaded via CSV” → `"csv_upload"`.
      - “Entered manually” → `"manual"`.
    - Track `editSource` in local state.
    - On save:
      - If changed, include `source` in `TransactionDetailUpdate`.

- Callers (Inbox, Activity, Tax details):
  - Pass `onSave` so `source` flows into `/api/transactions/update`.
  - Keep read-only display consistent where editing is not enabled.

### 4.2 Transactions List – Data Source Indicator & Filter

- Per-row source tag (`ActivityTable`):
  - Add a small, typographic label near the vendor/account name:
    - Style:
      - Muted text.
      - Hairline border pill (light gray).
      - Very lightweight; does not compete with amount/date/vendor.
    - Label mapping:
      - `source === "data_feed"` → “Stripe”.
      - `source === "csv_upload"` → “CSV”.
      - `source === "manual"` or null → “Manual”.
  - Aesthetic benchmarks:
    - Reference Aesop, Work & Co, Practicing the Way:
      - Minimal, typographic, no heavy colors or icons.

- Transaction detail consistency:
  - Ensure the same mapping/labels are used in the detail view `Data source` row, alongside explanatory text.

- Filter by data source:
  - Backend:
    - `/api/transactions`:
      - Accept `source` filter and `activityViewFiltersSchema.source`.
      - Filter `transactions.source` when provided.
  - Frontend:
    - `ActivityToolbar`:
      - Add “Source” filter:
        - Options: “All” plus per-source labels present for the user (Stripe, CSV, Manual).
      - Show selected filter as part of filter summary.
    - Persist filter via `activity_view_settings.filters`:
      - Include `source` so it survives reload and is part of the bookmarkable state (query params).

---

## 5. Data Sources & Stripe Financial Connections

### 5.1 Stripe keys & environment

- Use env-driven configuration (no domain hardcoding):
  - `.env.local` for localhost:
    - Stripe sandbox keys: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` set to test keys.
  - Deployment environment (e.g. `expenseterminal.com`):
    - Live Stripe keys in environment.
  - `lib/stripe.ts`:
    - Always initialize from env; may expose mode (`test` vs `live`) if needed.

### 5.2 Stripe Financial Connections (bank pulling)

- Integration:
  - Use Stripe Financial Connections as the **only** external integration:
    - Remove Plaid references from code, comments, UI.
  - Scope:
    - Transactions only; no balance data needed.
  - Error handling:
    - Map Stripe error codes (auth failure, institution unavailable, permissions, user-cancel) to:
      - Clear UI messages in Add Source flow.
      - Structured logs for debugging.

### 5.3 Data Sources Page – list, failure, retry

- List view:
  - For each `data_sources` row:
    - Show:
      - Account name (`name`).
      - Source type:
        - “Manual” for `source_type = 'manual'`.
        - “Bank Pulling via Stripe” or “Stripe” for `source_type = 'stripe'` (with optional Stripe badge).
      - Last pulled date:
        - Stripe: `last_successful_sync_at` (or “Never”).
        - Manual: `connected_at` or omit label.
      - Transaction count:
        - Stripe: `transaction_count` (e.g. “245 transactions”).
        - Manual: omit or display “—”.

- Visual distinction:
  - Use subtle tags/pills/icons to differentiate manual vs Stripe.

- Sync failure UI:
  - If `last_failed_sync_at` is set:
    - Show a banner or inline warning:
      - “We couldn't sync this account.”
      - “Last successful sync: <timestamp or ‘never’>”.
      - Short error detail from `last_error_summary` or generic fallback.
    - Button: “Retry sync” → calls `/api/data-sources/sync`.

### 5.4 Add New Source – multi-step flow

#### Step 1 – Selection

- Entry:
  - When user clicks “Add source”:
    - Show a selection screen with two equal-width options:
      - **Manual**
      - **Bank Pulling**
- Each card:
  - Manual:
    - Description: add accounts manually; transactions come via manual entry or CSV uploads.
  - Bank Pulling:
    - Description: connect a bank via **Stripe Financial Connections**.
    - Include:
      - “Stripe” text link to `https://stripe.com` in new tab, styled with Stripe purple (`#635bff`, bold).
      - Short note about secure bank connection.

- Free vs Pro gating:
  - If `isFree` and user already has one Stripe (`source_type = 'stripe'`) data source:
    - Render Bank Pulling card as locked:
      - Dimmed, “Pro” badge, lock icon.
    - On click:
      - Open Upgrade modal (no API call).

#### Step 2a – Manual flow

- On selecting Manual:
  - Show existing manual source form:
    - Required: account name.
    - Any existing fields preserved.
  - Back button:
    - Returns to Step 1.
  - On save:
    - Insert `data_sources` row:
      - `source_type = 'manual'`
      - `name = account name`
      - `connected_at = now()`
    - Redirect to Data Sources list or show light confirmation.

#### Step 2b – Bank Pulling: lookback

- On selecting Bank Pulling:
  - Show lookback selection:
    - Two full-width primary buttons:
      - **Last 2 Years**:
        - Helper text: “Maximum supported by Stripe”.
      - **Only Going Forward**:
        - Helper text: “Pulls no historical data; starts from the date of connection”.
    - Below:
      - Date input for custom start date:
        - Only required/used if user chooses “Custom”.
        - Validation:
          - Valid date format (e.g. `YYYY-MM-DD`).
          - Not more than 2 years in the past.
          - Inline error messages on failure.

  - “Connect with Stripe” button:
    - Enabled only when a valid lookback choice is set.
    - On click:
      - Persist lookback choice (mode + optional `start_date`) in session/DB.
      - Start Stripe Financial Connections flow.

#### Stripe Financial Connections flow

- UI:
  - Open Stripe Financial Connections inline:
    - Stripe’s recommended iframe/overlay pattern.
- Callback:
  - Route like `app/api/data-sources/stripe/callback` or a page route:
    - Validate session and Stripe payload.
    - Create or update `data_sources` row:
      - `source_type = 'stripe'`
      - `name` = Stripe account name or user alias.
      - `stripe_account_id` and `financial_connections_account_id`.
      - `connected_at = now()` if first time.
    - Kick off initial transaction pull based on lookback:
      - Last 2 years (bounded by Stripe’s max).
      - Only going forward.
      - Custom start date (validated ≤ 2 years old).

#### Loading & confirmation

- Loading screen:
  - After starting initial import:
    - Show context-aware steps, e.g.:
      - “Connecting to your bank…”
      - “Authenticating your account…”
      - “Pulling your transactions…”
      - “Organizing everything…”
    - Visual: minimal animation or progress indicator.

- Error handling:
  - On any error (Stripe error, import failure, validation issue):
    - Perform best-effort rollback of:
      - Newly created but incomplete `data_sources` row.
      - Partially imported transactions (or mark them discarded).
    - Return user to Step 1 with:
      - Clear error banner and explanation.
      - Invitation to try again.

- Confirmation page:
  - On successful completion:
    - Show:
      - Account name.
      - Source type (Manual / Bank Pulling via Stripe).
      - Last pulled date:
        - For Stripe: `last_successful_sync_at`.
        - For Manual: `connected_at` or similar.
      - Transaction count:
        - Only for Stripe (`transaction_count`).
    - CTA:
      - “View Transactions” → All Activity page.
    - Secondary: “Back to Data Sources”.
  - After CTA or delay:
    - Redirect to Data Sources list.

---

## 6. Automation: Cron, Notifications, Resend

### 6.1 EventBridge daily jobs (2:00 AM EST)

- One or two EventBridge rules:
  - **Stripe import job**:
    - At 2:00 AM EST:
      - For each Stripe `data_sources` row:
        - Determine user plan:
          - `isPro` vs `isFree`.
        - Set Stripe `created` window:
          - Pro: full intended history window (since last_successful_sync_at).
          - Free: limited to last 30 days (see 7.2).
        - Pull new transactions.
        - Insert into `transactions` (`source = "data_feed"`, `data_source_id` set).
        - Call `applyRulesToTransactions` on new IDs.
        - On success:
          - Update `last_successful_sync_at`, `transaction_count`.
        - On failure:
          - Retry once.
          - If still failing:
            - Set `last_failed_sync_at`, `last_error_summary`.

  - **Notification job**:
    - At 2:00 AM EST:
      - For each `notification_preferences` row:
        - Compute unsorted transaction count (e.g. `status = 'pending'`).
        - If `type = 'count_based'`:
          - If unsortedCount ≥ threshold (from `value`):
            - Send reminder email.
            - Set `last_notified_at = now`.
            - Optionally `last_counter_reset_at = now`.
        - If `type = 'interval_based'`:
          - If interval (daily/weekly/monthly/quarterly) since `last_notified_at` has elapsed and unsortedCount > 0:
            - Send reminder email.
            - Set `last_notified_at = now`.

### 6.2 Resend email

- `lib/email/send-unsorted-reminder.ts`:
  - Use Resend with:
    - Subject: `"Reminder to sort expenses for tax deductions"`.
    - From: `ExpenseTerminal <hello@expenseterminal.com>`.
  - Single HTML template:
    - Includes:
      - Unsorted transaction count.
      - Date range of those transactions.
      - Account/workspace name.
      - CTA button “Sort Now” linking to login/Inbox.
  - Both count-based and interval-based cron flows call this helper.

- Future: same email template can be reused for other nudges if needed.

---

## 7. Plans, Limits, Billing & Upgrades

### 7.1 Plan mapping & consolidation

- DB & Stripe:
  - Keep existing `subscriptions.plan` values:
    - `"starter"` and `"plus"` (no DB/Stripe renames).
  - Stripe product/price IDs remain the same; product name has been updated in Stripe UI to “Pro”.

- Derived plan flags (`lib/billing/get-user-plan.ts`):
  - `isPro`:
    - Active subscription with `plan === 'plus'` (Pro, formerly Plus) **or** `plan === 'starter'` (grandfathered Starter).
  - `isFree`:
    - No active Pro-equivalent subscription.

- Enrollment:
  - Remove Starter from all flows:
    - `/pricing`, `/billing`, upgrade modal, sidebar.
  - `/api/billing/checkout`:
    - Only support the Pro/plus product code.
    - Never reference Starter in code or UI.

- Copy:
  - Replace “Plus” with “Pro” in all customer facing surfaces:
    - Pricing page.
    - Billing page.
    - Upgrade copy (modal, sidebar, etc.).
  - Internal constants like `PLUS_PLAN` can remain but `.name` should display “Pro”.

### 7.2 Free vs Pro feature gating

- **AI transactions (Free limit 200)**:
  - Billing logic/usage:
    - Track number of transactions analyzed by AI (existing usage table or new).
  - `/api/transactions/analyze`:
    - Before analyzing:
      - If `isFree` and this batch would push the total over 200:
        - Return structured error: `{ code: "ai_limit_reached", ... }`.
  - Inbox / Activity UIs:
    - When receiving `ai_limit_reached`:
      - Do not proceed.
      - Open Upgrade modal with Pro benefits.

- **Stripe data sources (Free max 1)**:
  - API (`/api/data-sources`):
    - On create for Stripe `source_type`:
      - If `isFree` and user already has a Stripe source:
        - Return `code: "pro_required_stripe_sources"`.
  - UI (`DataSourcesClient`):
    - When `isFree` and one Stripe source exists:
      - Bank Pulling card locked (as in 5.4).
      - Clicking it opens Upgrade modal.

- **Stripe history (Free last 30 days)**:
  - Import worker & manual sync:
    - If `isFree`:
      - Limit Stripe `created` filter: `created >= now - 30 days`.
    - If `isPro`:
      - Use full lookback as defined by lookback selection and subsequent `last_successful_sync_at`.

### 7.3 Upgrade modal (shared)

- Component: `components/UpgradeModal.tsx`:
  - Content:
    - Headline: indicates Free plan is limited.
    - Value prop:
      - Placeholder stat: e.g. “On average, organized businesses save $X/year in taxes.” (to be refined).
    - Bulleted Pro benefits (not just feature names):
      - Unlimited AI categorization.
      - Multiple Stripe bank connections.
      - Full transaction history (beyond 30 days).
      - Rules & alerts automation.
    - Single primary CTA:
      - “Upgrade to Pro”:
        - Calls `/api/billing/checkout` with Pro/plus product code.
        - Redirects to Stripe Checkout URL returned by API.

- Hook/context:
  - `useUpgradeModal()` or similar:
    - Provides `openUpgradeModal(reason?: string)`.
  - Used by:
    - AI flows on 200-transaction limit.
    - Data Sources when attempting second Stripe connection.
    - Any other Pro-locked feature.

- Single Checkout flow:
  - All upgrade entry points must reuse the same helper/endpoint:
    - Upgrade modal.
    - Billing page “Upgrade to Pro”.
    - Sidebar upgrade box.
    - Pricing page CTA.

### 7.4 Billing page – Free vs Pro

- Free state:
  - Usage dashboard:
    - Bars for:
      - AI transactions (used out of 200).
      - Stripe data sources (0/1).
      - Transaction history range (current vs 1-month cap).
    - Bars shift to warning state at ≥ 80% usage:
      - Amber/orange color, subtle icon/tag.
  - Pro value section:
    - Marketing-style breakdown of Pro:
      - Outcomes and benefits (tax savings, time, automation).
      - 3–5 bullet groups (e.g. “Save time”, “Avoid missed deductions”, “Stay organized”).
  - CTA:
    - Single prominent “Upgrade to Pro” button:
      - Calls shared `/api/billing/checkout`.
    - After successful checkout:
      - Redirect back to Billing page in Pro state.

- Pro state:
  - Summary:
    - Current plan: Pro.
    - Renewal date/current period end.
  - Billing info:
    - Past receipts (if already exposed).
  - Manage button:
    - “Manage plan” / “Cancel”:
      - Routes to Stripe Customer Portal via `/api/billing/portal`.

### 7.5 Sidebar upgrade box (Free users)

- In `Sidebar`:
  - For `isFree`:
    - Show upgrade box inspired by Notion’s sidebar prompt:
      - Title: “Upgrade to Pro”.
      - Body:
        - “93% of businesses leave money on the table at tax time. Pro helps make sure you're not one of them.”
        - Stat from Forbes.
      - Button:
        - “Upgrade to Pro” → shared Stripe Checkout flow.
  - For `isPro`:
    - Hide upgrade box permanently.

- Mobile:
  - If there is no sidebar (mobile layout):
    - Do not show this box (rely on Billing, Pricing, modal).

### 7.6 Public Pricing page – single Pro plan

- `/pricing`:
  - Accessible:
    - Pre-login.
    - Post-login (Free or Pro).
  - Single paid plan:
    - Pro only; no Starter; no side-by-side tiers.

- Content:
  - Pro plan pricing and cadence:
    - Use existing plan definition for plus/Pro.
  - Feature list:
    - Clearly states what Pro includes vs Free:
      - Unlimited AI vs 200.
      - Multiple Stripe sources vs 1.
      - Full history vs 30 days.
      - Rules automation, alerts, etc.
  - FAQ:
    - Placeholder Q&A:
      - Billing, cancellation, downgrade behavior, what happens to data.
    - Mark placeholders clearly in code (comments or TODO markers) for later copy editing.

- CTA behavior:
  - Logged-in Free:
    - Primary CTA “Upgrade to Pro”:
      - Calls shared Stripe Checkout flow.
  - Logged-out:
    - CTA leads to sign up/login first:
      - After auth, continues to same Checkout flow.
  - Pro users:
    - Do not show upgrade CTA.
    - Instead:
      - Show “You’re on Pro” badge.
      - Provide “Manage plan” link (Customer Portal).

- Responsive design:
  - Fully responsive:
    - Stack content on mobile.
    - Maintain typographic, restrained style (no clutter).

---

## 8. Execution Order (Suggested)

1. **Foundation & DB**
   - Extend `auto_sort_rules`, `data_sources`, `notification_preferences` in schema.
   - Update TS types + validation schemas.

2. **Rules Engine & Rules Page**
   - Implement `lib/rules/types.ts` & `lib/rules/engine.ts`.
   - Build `/api/rules` + `/api/rules/apply`.
   - Build Rules Page list + rule editor + Apply Scope modal.
   - Implement Notification Controls UI + modal + `/api/notification-preferences`.

3. **Transaction & Activity UI**
   - Implement Data source section in Transaction Detail.
   - Add per-row source tags & filters in Activity.
   - Wire `source` editing through `/api/transactions/update`.

4. **Data Sources & Stripe FC**
   - Implement env-based Stripe config.
   - Add multi-step Add Source flow (Manual vs Bank Pulling).
   - Implement Stripe Financial Connections callback & initial import.
   - Add sync-failure UI, manual retry.

5. **Automation**
   - Implement Stripe import worker logic (even if in a separate repo).
   - Implement EventBridge daily jobs (import + notifications).
   - Integrate Resend email helper.

6. **Plans, Limits & Upgrade UX**
   - Implement `isFree`/`isPro` + plan mapping.
   - Enforce AI/Stripe/history limits for Free.
   - Build Upgrade modal, Billing page free/pro states, sidebar upgrade box.
   - Rebuild Pricing page as single-Pro plan and wire to same checkout.

7. **Polish & QA**
   - Verify all acceptance criteria for:
     - Rules/data source tickets.
     - Cron + notification tickets.
     - Plan consolidation, upgrade UX, Pricing.
   - Focus on:
     - Edge cases (errors in Stripe flows, retries).
     - Bookmarkable filters & persisted preferences.
     - Free vs Pro gating consistency across surfaces.

