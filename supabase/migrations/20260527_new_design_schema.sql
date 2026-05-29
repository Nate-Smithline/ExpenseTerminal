-- =============================================================================
-- New design schema: Budget, Review, Cash-flow, Tax improvements
-- Run this ONCE against the production Supabase database.
-- All statements use IF NOT EXISTS / IF EXISTS so re-running is safe.
-- =============================================================================


-- ── 1. Marker columns on transactions ─────────────────────────────────────────
-- marker: Personal | Business | Partial | null (untagged)
-- business_pct: 0–100, only meaningful when marker = 'Partial'
-- schedule_c_line: IRS line label for Business/Partial expenses (e.g. "Advertising")
-- hint_vendor: normalized vendor name used by auto-assignment
-- hint_plaid_category: Plaid personal_finance_category.primary

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS marker TEXT
    CHECK (marker IN ('Personal', 'Business', 'Partial')),
  ADD COLUMN IF NOT EXISTS business_pct SMALLINT
    CHECK (business_pct >= 0 AND business_pct <= 100),
  ADD COLUMN IF NOT EXISTS schedule_c_line TEXT,
  ADD COLUMN IF NOT EXISTS hint_vendor TEXT,
  ADD COLUMN IF NOT EXISTS hint_plaid_category TEXT;

-- Partial rows must have a business_pct
-- (enforced in app logic; constraint omitted here to avoid migration noise on existing data)

CREATE INDEX IF NOT EXISTS idx_transactions_marker
  ON public.transactions(marker)
  WHERE marker IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_schedule_c_line
  ON public.transactions(schedule_c_line)
  WHERE schedule_c_line IS NOT NULL;


-- ── 2. is_tax_fund flag on data_sources ───────────────────────────────────────
-- When true, the account balance is shown as "Tax fund" in the Tax hero panel.

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS is_tax_fund BOOLEAN NOT NULL DEFAULT FALSE;


-- ── 3. budget_months ──────────────────────────────────────────────────────────
-- One row per user per month. Links to groups/lines below.
-- month_key format: 'YYYY-MM' (e.g. '2026-05')

CREATE TABLE IF NOT EXISTS public.budget_months (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key     TEXT NOT NULL,           -- 'YYYY-MM'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month_key)
);

ALTER TABLE public.budget_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budget_months"
  ON public.budget_months
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_budget_months_user_month
  ON public.budget_months(user_id, month_key);


-- ── 4. budget_groups ──────────────────────────────────────────────────────────
-- Named sections inside a budget month (e.g. "Marketing", "Operations").

CREATE TABLE IF NOT EXISTS public.budget_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_month_id UUID NOT NULL REFERENCES public.budget_months(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  position        SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budget_groups"
  ON public.budget_groups
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_budget_groups_month
  ON public.budget_groups(budget_month_id);


-- ── 5. budget_lines ───────────────────────────────────────────────────────────
-- Individual expense/income line items within a group.
-- allocated: user-entered budget amount (may be NULL = unbudgeted line)
-- rolled_over: amount carried from prior month

CREATE TABLE IF NOT EXISTS public.budget_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_group_id UUID NOT NULL REFERENCES public.budget_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  allocated       DECIMAL(12, 2),
  rolled_over     DECIMAL(12, 2) NOT NULL DEFAULT 0,
  position        SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budget_lines"
  ON public.budget_lines
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_budget_lines_group
  ON public.budget_lines(budget_group_id);


-- ── 6. budget_line_transactions ───────────────────────────────────────────────
-- M2M join: which transactions are assigned to which budget line.
-- A transaction can only be assigned to one line at a time (UNIQUE on tx_id).

CREATE TABLE IF NOT EXISTS public.budget_line_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_line_id  UUID NOT NULL REFERENCES public.budget_lines(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_id)   -- one line per transaction
);

ALTER TABLE public.budget_line_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budget_line_transactions"
  ON public.budget_line_transactions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_blt_line
  ON public.budget_line_transactions(budget_line_id);

CREATE INDEX IF NOT EXISTS idx_blt_transaction
  ON public.budget_line_transactions(transaction_id);


-- ── 7. net_worth_snapshots ────────────────────────────────────────────────────
-- Daily/monthly balance snapshots for Cash Flow page charts.
-- captured_on: date the snapshot was taken (YYYY-MM-DD).
-- balance_cents: signed balance in cents (negative = liability).

CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_source_id  UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  captured_on     DATE NOT NULL,
  balance_cents   BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, data_source_id, captured_on)
);

ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own net_worth_snapshots"
  ON public.net_worth_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role writes snapshots; no user INSERT policy needed.

CREATE INDEX IF NOT EXISTS idx_nw_snapshots_user_date
  ON public.net_worth_snapshots(user_id, captured_on DESC);


-- ── 8. review_items ───────────────────────────────────────────────────────────
-- Smart inbox tasks: rule suggestions, unusual transactions, tax nudges, etc.
-- urgency: 1 (low) → 3 (high) — controls sort order.
-- kind: discriminant for rendering the right card UI.

CREATE TABLE IF NOT EXISTS public.review_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,   -- 'rule_suggestion' | 'unusual_tx' | 'tax_nudge' | 'untagged'
  title         TEXT NOT NULL,
  body          TEXT,
  urgency       SMALLINT NOT NULL DEFAULT 1 CHECK (urgency BETWEEN 1 AND 3),
  payload       JSONB,           -- kind-specific data (e.g. { transaction_id, rule_id })
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  done_at       TIMESTAMPTZ,
  dismissed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own review_items"
  ON public.review_items
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_review_items_user_active
  ON public.review_items(user_id, urgency DESC, created_at ASC)
  WHERE done = FALSE AND dismissed = FALSE;
