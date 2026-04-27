# Schema map (Expense Terminal)

Single reference for Postgres, TypeScript types, Zod validation, domain logic, ops SQL, and shared UI components.

## How `schema.sql`, migrations, and types relate

| Source | Role |
|--------|------|
| [`supabase/schema.sql`](../supabase/schema.sql) | Bootstrap / reference DDL for a fresh environment. Includes core tables, many indexes, RLS for app tables, triggers (`handle_new_user`), subscriptions, `eligible_for_ai`, notification preferences, email verifications. **Does not include** everything added only via migrations after it was last updated (see drift below). |
| [`supabase/migrations/*.sql`](../supabase/migrations/) | Incremental, ordered changes for existing databases. **Ground truth** for production: apply in filename order. |
| [`lib/types/database.ts`](../lib/types/database.ts) | Hand-maintained `Database` type for `@supabase/supabase-js`. Should match the merged logical schema. |

**Workflow:** New environments: run `schema.sql` then apply any migrations not yet folded into it, or rely on migration history from empty DB. Production fixes: prefer idempotent scripts in `supabase/` (e.g. `ensure_db_up_to_date.sql`) plus migrations.

---

## Migrations (chronological)

| File | Summary |
|------|---------|
| `20260221_fix_deductions_rls.sql` | Deductions RLS: `WITH CHECK` on insert/update. |
| `20260223_avatars_storage_bucket.sql` | Storage bucket `avatars`, policies for insert/read/update/delete. |
| `20260223_fix_avatars_insert_policy.sql` | Recreates avatar INSERT policy on `storage.objects`. |
| `20260223_profiles_name_prefix.sql` | `profiles.name_prefix`. |
| `20260225_subscriptions_and_eligible_for_ai.sql` | `subscriptions` table; `transactions.eligible_for_ai` + index. |
| `20260226_password_reset_tokens.sql` | `password_reset_tokens` (RLS, no user policies—service role). |
| `20260227_activity_view_settings.sql` | `activity_view_settings` + RLS (select/insert/update). |
| `20260307_data_sources_stripe_sync_start_date.sql` | `data_sources.stripe_sync_start_date`. |
| `20260308_amex_card_to_direct_feed.sql` | **Data migration:** sets `source_type = 'stripe'` for named `Amex Card` rows. |
| `20260308_notification_preferences.sql` | `notification_preferences` table + RLS. |
| `20260308_transactions_data_feed_unique_constraint.sql` | `transactions` unique constraint on `(data_source_id, data_feed_external_id)` for upsert. |
| `202603161200_normalize_org_address.sql` | `org_settings` structured address columns. |
| `202603261200_start_here_flow.sql` | `org_settings.personal_filing_status`, `tax_year_settings.expected_income_range`. |
| `202603271200_business_industry.sql` | `org_settings.business_industry`. |
| `202603281200_tax_filing_tables.sql` | `tax_filing_overrides`, `disclaimer_acknowledgments` + RLS + indexes. |
| `202603281300_plaid_data_sources.sql` | Plaid columns on `data_sources` + index on `plaid_item_id`. |
| `202604171400_plan_enrichment_quarterly_reminder.sql` | `transactions` enrichment columns (`plaid_raw_json`, `display_name`, rename/deduction fields, `enrichment_status`, inbox routing); `profiles.last_quarterly_tax_reminder_sent_at`. |

---

## Profiles / transactions (plan migration)

| Column | Table | Purpose |
|--------|-------|---------|
| `last_quarterly_tax_reminder_sent_at` | `profiles` | Idempotency for quarterly tax reminder emails (ET schedule). |
| `plaid_raw_json`, `display_name`, `rename_*`, `deduction_*`, `routed_to_inbox`, `inbox_resolved_at`, `enrichment_status` | `transactions` | Plaid enrichment pipeline (`docs/plans.md`). |

---

## Workspace strategy (ExpenseTax / plans.md)

- **Current model:** Data is **user-scoped** (`user_id` on `transactions`, `data_sources`, `deductions`, etc.). RLS policies use `auth.uid() = user_id`.
- **Direction:** Introduce **workspaces** incrementally without a big-bang migration: add optional `workspace_id` later with a **default workspace per user**, backfill, then attach new features to workspaces.
- **RLS:** A **stricter** model (policies via `workspace_members`) is deferred until multi-entity support is required; document new tables with `workspace_id` when added.

---

## Schema gaps vs `docs/plans.md` (tracking)

| plans.md concept | Current state | Next additive steps |
|----------------|---------------|---------------------|
| `Workspace` / `WorkspaceMember` | Not in DB | New tables + nullable `workspace_id` on selected entities when prioritized |
| `CalculatedDeduction` wide row | `deductions` + `metadata` JSON | Use `metadata` for home office dual-method fields; or add columns via migration |
| `MerchantMemory` | `vendor_patterns` | Extend `vendor_patterns` or add `merchant_memory` table with `raw_name_pattern` |
| Rich `Transaction` Plaid fields | `plaid_raw_json`, `display_name`, enrichment fields | Migration `202604171400_*` |
| `Notification` table | Not present | Reuse email + optional `notifications` table later |
| Account type `personal \| business \| mixed` | `data_sources.account_type` exists as string | Validate allowed values in UI/API |

---

## Postgres tables and RLS (merged view)

| Table | Purpose |
|-------|---------|
| `profiles` | User display, onboarding, notifications prefs, terms; 1:1 with `auth.users`. |
| `email_verifications` | Hashed tokens for email verification. RLS: users SELECT own. |
| `password_reset_tokens` | Hashed reset tokens. RLS enabled; no client policies (server/service only). |
| `transactions` | Core ledger; AI fields, status, feeds, `eligible_for_ai`. RLS: own rows. |
| `data_sources` | Manual/Stripe/Plaid connections, sync metadata. RLS: own rows. |
| `auto_sort_rules` | Rules engine (conditions/action JSON). RLS: own rows. |
| `deductions` | Typed deduction amounts per tax year (`type` string). RLS: own rows. |
| `vendor_patterns` | Cached vendor→category/line hints. RLS: own rows. |
| `org_settings` | Business profile, address, filing, industry. RLS: own rows. |
| `tax_year_settings` | Per-year tax rate, expected income range. RLS: own rows. |
| `notification_preferences` | Unsorted reminder schedule. RLS: own rows. |
| `subscriptions` | Stripe subscription mirror. RLS: view + manage own. |
| `activity_view_settings` | Activity table sort, columns, filters. RLS: view/insert/update own. |
| `tax_filing_overrides` | User overrides for export line values. RLS: own rows. |
| `disclaimer_acknowledgments` | Tax filing disclaimer acks. RLS: own rows. |

**Not in `public` tables:** `auth.users` (Supabase Auth). **Storage:** bucket `avatars` with policies on `storage.objects`.

**RLS policy names (typical patterns):** `profiles`: view/update own; `transactions`, `data_sources`, `auto_sort_rules`, `vendor_patterns`, `org_settings`, `tax_year_settings`: manage own; `deductions`: manage own with `WITH CHECK`; `notification_preferences`: manage own; `subscriptions`: view + manage own; `email_verifications`: view own; `activity_view_settings`: separate select/insert/update policies.

---

## TypeScript (`lib/types/database.ts`) vs database

- **Aligned:** All tables above are represented; Plaid columns; `expected_income_range`; `personal_filing_status`; `business_industry`; `tax_filing_overrides` / `disclaimer_acknowledgments`.
- **Fixed drift:** `profiles.name_prefix` was added to match migration `20260223_profiles_name_prefix.sql`.
- **Notes:** Numeric/decimal columns often appear as `string` in Insert/Row types. `tax_filing_overrides.original_value` / `override_value` are `string` in TS; migration uses `DECIMAL` in SQL.

---

## Zod schemas and API routes

Defined in [`lib/validation/schemas.ts`](../lib/validation/schemas.ts).

| Export / helpers | Used by |
|------------------|---------|
| `transactionIdsBodySchema` | `POST /api/transactions/analyze` |
| `transactionUpdateBodySchema` | `POST /api/transactions/update` |
| `transactionUploadBodySchema` | `POST /api/transactions/upload` |
| `transactionDeleteBodySchema` | `POST /api/transactions/delete` |
| `transactionPostBodySchema`, `transactionDraftBodySchema`, `parseQueryLimit`, `parseQueryOffset`, `parseQueryTaxYear`, `uuidSchema`, `ACTIVITY_SORT_COLUMNS` | `GET`/`POST` `/api/transactions` |
| `taxYearSettingsPostSchema` | `POST` `/api/tax-year-settings` |
| `deductionPostSchema`, `deductionDeleteSchema`, `parseQueryLimit`, `parseQueryOffset` | `/api/deductions` |
| `activityViewSettingsPatchSchema`, filters/sort/columns enums | `/api/activity-view-settings` |
| `notificationPreferencesSchema` | `/api/notification-preferences` |
| `parseQueryLimit`, `parseQueryOffset` | `/api/data-sources` |
| `ACTIVITY_SORT_COLUMNS` | `/api/transactions/export` |

**Routes without shared Zod imports (validate inline or trust query):** e.g. `/api/profile`, `/api/org-settings`, `/api/rules`, billing, webhooks, cron, tax-filing—candidates to consolidate later.

---

## Domain layer (non-DDL)

| Area | Files | Relates to DB |
|------|-------|----------------|
| Deduction UI routes | [`lib/deduction-types.ts`](../lib/deduction-types.ts) | `deductions.type` stores keys like `home_office`, `qbi`, … |
| Schedule C lines & filing | [`lib/tax/schedule-c-lines.ts`](../lib/tax/schedule-c-lines.ts) | `transactions.schedule_c_line` |
| QBI math | [`lib/tax/qbi.ts`](../lib/tax/qbi.ts) | Deduction type `qbi` |
| Form calculations | [`lib/tax/form-calculations.ts`](../lib/tax/form-calculations.ts) | Aggregations for UI/export |
| IRS mappings | [`lib/tax/irs-form-mappings.ts`](../lib/tax/irs-form-mappings.ts) | Export / tax filing center |

---

## Non-migration SQL under `supabase/` (classification)

| File | Classification | Notes |
|------|----------------|-------|
| `ensure_db_up_to_date.sql` | **Keep (ops)** | Idempotent column/index fixes for sync and Plaid. |
| `validate_db.sql` | **Keep (ops)** | Validation checks. |
| `fix_auto_sort_rules.sql` | **Keep (ops)** | One-off repair; run when needed. |
| `fix_stripe_direct_feed_signs.sql` | **Keep (ops)** | Data repair for Stripe amounts. |
| `run-subscriptions-table.sql` | **Keep (ops)** | Legacy/bootstrap subscriptions DDL if needed. |
| `delete-transactions-by-email.sql` | **Dangerous / one-off** | Destructive; do not run without review. |
| `delete-transactions-2026.sql` | **Dangerous / one-off** | Same. |
| `schema.sql` | **Reference** | See above. |

---

## Shared components audit

Location: [`components/`](../components/).

| File | Consumers |
|------|-----------|
| `AppShell.tsx` | `app/layout.tsx` (wraps app; Sidebar + UpgradeModalProvider). |
| `Sidebar.tsx` | `AppShell` |
| `UpgradeModal.tsx`, `UpgradeModalContext.tsx` | `AppShell` |
| `LandingHeader.tsx` | Marketing/legal/pricing/landing/request-demo |
| `LegalBackLink.tsx` | cookies, privacy, terms |
| `AuthLayout.tsx` | login, signup, forgot/reset password, verify-pending |
| `SeoJsonLd.tsx` | landing, pricing, request-demo, `app/page.tsx` |
| `PricingPlansGrid.tsx` | landing, pricing |
| `TaxYearSelector.tsx` | dashboard, activity, inbox, data-sources, tax-filing, other-deductions, tax-details |
| `TransactionCard.tsx`, `TransactionDetailPanel.tsx` | inbox, activity, tax-details, dashboard sections |
| `SimilarTransactionsPopup.tsx` | inbox |
| `UploadModal.tsx` | inbox, data-sources |
| `CurrencyInput.tsx` | deductions, dashboard, tax-filing |
| `BackToDeductionsLink.tsx` | deduction subpages |
| `CommandPalette.tsx` (`CommandPaletteProvider`, sidebar + mobile triggers) | `AppShell` + `Sidebar` — Notion-style transaction search (⌘K); mobile footer **Search** opens same modal |
| `DashboardQuarterlyHighlight.tsx` | `app/dashboard/page.tsx` — `?highlight=quarterly` deep link |

**Cleanup (this pass):** Removed duplicate `/test` page (`app/test/page.tsx`) in favor of `/brand`. Deleted unused modules: `CreateTransactionModal`, `DeductionWidgets`, `PreferencesHeader`, `PricingClient`, `ReportExportActions`, `AnthropicDiagnostics`, `TaxDetailsClient`, and `lib/format.ts` (call sites used local `formatCurrency` helpers).

**Optional follow-up:** Extract shared swatch UI from `app/brand/page.tsx` only if more brand previews are added (not required for this pass).

---

## Dev-only routes

| Route | Decision |
|-------|----------|
| `/brand` | Kept as the canonical internal brand/color reference (not linked from main nav). |
| `/api/test-anthropic` | **Kept** — manual or scripted connectivity check (authenticated); no in-app UI. |
