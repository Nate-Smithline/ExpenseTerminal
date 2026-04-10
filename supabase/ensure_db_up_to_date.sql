-- =============================================================================
-- Ensure database is up to date for Expense Terminal (sync, data sources, transactions)
-- Run this in Supabase SQL Editor or via psql. Safe to run multiple times (idempotent).
--
-- Critical for sync: section 3 adds the UNIQUE constraint on (data_source_id,
-- data_feed_external_id) so Supabase upsert() can resolve conflicts. Without it,
-- sync completes but 0 transactions are inserted.
--
-- If section 5 fails (e.g. "policy already exists"), comment out that block.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. data_sources: missing columns (Stripe / Direct Feed)
-- -----------------------------------------------------------------------------
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS financial_connections_account_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_failed_sync_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_error_summary TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS stripe_sync_start_date DATE;

-- Plaid columns (added in Stripe-to-Plaid migration)
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_access_token TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_item_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_cursor TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_institution_id TEXT;

ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_balance_current NUMERIC(18, 2);
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_balance_available NUMERIC(18, 2);
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_balance_limit NUMERIC(18, 2);
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_balance_iso_currency_code TEXT DEFAULT 'USD';
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_balance_as_of TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_data_sources_plaid_item_id
  ON public.data_sources(plaid_item_id)
  WHERE plaid_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_sources_plaid_item_account
  ON public.data_sources (plaid_item_id, plaid_account_id)
  WHERE plaid_item_id IS NOT NULL;

-- Unique index: one data source per Stripe FC account per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_sources_user_fc_account
  ON public.data_sources(user_id, financial_connections_account_id)
  WHERE financial_connections_account_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. transactions: columns required for Direct Feed (Stripe) upsert
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.data_sources(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_feed_external_id TEXT;

-- Index for listing transactions by data source
CREATE INDEX IF NOT EXISTS idx_transactions_data_source ON public.transactions(data_source_id);

-- Partial unique index (for queries); kept for compatibility
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_data_feed_external
  ON public.transactions(data_source_id, data_feed_external_id)
  WHERE data_feed_external_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. transactions: UNIQUE constraint so Supabase upsert onConflict works
--    (Required for sync: ON CONFLICT (data_source_id, data_feed_external_id))
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_data_feed_external_key;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_data_feed_external_key
  UNIQUE (data_source_id, data_feed_external_id);

-- -----------------------------------------------------------------------------
-- 4. transactions: other columns/indexes used by app
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'expense';
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN ('expense', 'income'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deduction_percent INTEGER DEFAULT 100;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS eligible_for_ai BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_tax_year ON public.transactions(tax_year);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_year_status_type
  ON public.transactions(user_id, tax_year, status, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_ai_eligibility
  ON public.transactions(user_id, source, eligible_for_ai);

-- -----------------------------------------------------------------------------
-- 5. auto_sort_rules: table and columns (for "Apply to all similar")
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auto_sort_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vendor_pattern TEXT NOT NULL,
  quick_label TEXT NOT NULL,
  business_purpose TEXT,
  category TEXT,
  name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS action JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_auto_sort_rules_user ON public.auto_sort_rules(user_id);

-- -----------------------------------------------------------------------------
-- 6. RLS (ensure policies exist; skip if you already have them)
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own data sources" ON public.data_sources;
CREATE POLICY "Users can manage own data sources"
  ON public.data_sources FOR ALL
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 7. Tax Filing: overrides and disclaimer acknowledgments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_filing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tax_year INTEGER NOT NULL,
  form_type TEXT NOT NULL,
  line_key TEXT NOT NULL,
  original_value DECIMAL(12,2),
  override_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tax_year, form_type, line_key)
);

ALTER TABLE public.tax_filing_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tax filing overrides" ON public.tax_filing_overrides;
CREATE POLICY "Users can manage own tax filing overrides"
  ON public.tax_filing_overrides FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tax_filing_overrides_user_year
  ON public.tax_filing_overrides(user_id, tax_year);

CREATE TABLE IF NOT EXISTS public.disclaimer_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own disclaimer acks" ON public.disclaimer_acknowledgments;
CREATE POLICY "Users can manage own disclaimer acks"
  ON public.disclaimer_acknowledgments FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_disclaimer_acks_user
  ON public.disclaimer_acknowledgments(user_id, tax_year);

-- -----------------------------------------------------------------------------
-- Orgs: Accounts & Data page access (org-wide)
-- -----------------------------------------------------------------------------
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS accounts_page_visibility TEXT NOT NULL DEFAULT 'org';
ALTER TABLE public.orgs DROP CONSTRAINT IF EXISTS orgs_accounts_page_visibility_check;
ALTER TABLE public.orgs ADD CONSTRAINT orgs_accounts_page_visibility_check
  CHECK (accounts_page_visibility IN ('org', 'restricted'));

ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS icon_emoji TEXT;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS icon_image_url TEXT;

-- -----------------------------------------------------------------------------
-- data_sources: manual account balance (optional)
-- -----------------------------------------------------------------------------
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS manual_balance NUMERIC(18, 2);
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS manual_balance_iso_currency_code TEXT DEFAULT 'USD';

-- Brand palette key for sidebar / activity (see lib/brand-palette.ts)
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS brand_color_id TEXT NOT NULL DEFAULT 'blue';
ALTER TABLE public.data_sources DROP CONSTRAINT IF EXISTS data_sources_brand_color_id_check;
ALTER TABLE public.data_sources ADD CONSTRAINT data_sources_brand_color_id_check CHECK (
  brand_color_id IN (
    'black', 'white', 'blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'grey'
  )
);

-- transaction_property_definitions: add type 'account' (see migration 202604081400)
ALTER TABLE public.transaction_property_definitions DROP CONSTRAINT IF EXISTS transaction_property_definitions_type_check;
ALTER TABLE public.transaction_property_definitions
  ADD CONSTRAINT transaction_property_definitions_type_check CHECK (type IN (
    'multi_select', 'select', 'date', 'short_text', 'long_text', 'checkbox', 'org_user',
    'number', 'files', 'phone', 'email', 'created_time', 'created_by', 'last_edited_date',
    'last_edited_time', 'account'
  ));

-- -----------------------------------------------------------------------------
-- Org transaction rules (conditions + actions JSON, RLS via org_memberships)
-- Apply: supabase/migrations/202604081900_org_transaction_rules.sql
-- Apply: supabase/migrations/202604091200_org_rules_apply_to.sql (trigger_mode apply-to)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- user_financial_snapshots (daily net worth; see migration 202604101200)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_financial_snapshots (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  net_worth NUMERIC(18, 2) NOT NULL,
  total_assets NUMERIC(18, 2) NOT NULL,
  total_liabilities NUMERIC(18, 2) NOT NULL,
  accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_user_financial_snapshots_user_date_desc
  ON public.user_financial_snapshots (user_id, snapshot_date DESC);
ALTER TABLE public.user_financial_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own financial snapshots" ON public.user_financial_snapshots;
CREATE POLICY "Users can view own financial snapshots"
  ON public.user_financial_snapshots FOR SELECT
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- handle_new_user + finish_invited_workspace_join
-- Apply: supabase/migrations/202604101400_handle_new_user_invited_org.sql
--        supabase/migrations/202604101800_defer_invited_org_until_email_confirmed.sql
-- Workspace invite: membership only after email_confirmed_at (not when generateLink pre-creates the user).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  invite_org_id UUID;
BEGIN
  invite_org_id := NULL;
  IF NEW.raw_user_meta_data IS NOT NULL
     AND (NEW.raw_user_meta_data->>'invited_org_id') IS NOT NULL
     AND btrim(NEW.raw_user_meta_data->>'invited_org_id') <> '' THEN
    BEGIN
      invite_org_id := (NEW.raw_user_meta_data->>'invited_org_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      invite_org_id := NULL;
    END;
  END IF;

  IF invite_org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.orgs WHERE id = invite_org_id) THEN
    INSERT INTO public.profiles (id, email, first_name, last_name, email_opt_in, terms_accepted_at)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      COALESCE((NEW.raw_user_meta_data->>'email_opt_in')::boolean, false),
      CASE WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
           THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
           ELSE NULL END
    );

    IF NEW.email_confirmed_at IS NOT NULL THEN
      INSERT INTO public.org_memberships (org_id, user_id, role)
      VALUES (invite_org_id, NEW.id, 'member');
      UPDATE public.profiles SET active_org_id = invite_org_id WHERE id = NEW.id;
    END IF;

    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, email_opt_in, terms_accepted_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE((NEW.raw_user_meta_data->>'email_opt_in')::boolean, false),
    CASE WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
         ELSE NULL END
  );

  INSERT INTO public.orgs (name) VALUES ('My Organization')
  RETURNING id INTO new_org_id;

  INSERT INTO public.org_memberships (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  UPDATE public.profiles SET active_org_id = new_org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_invited_workspace_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  invite_org_id UUID;
BEGIN
  IF OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  invite_org_id := NULL;
  IF NEW.raw_user_meta_data IS NOT NULL
     AND (NEW.raw_user_meta_data->>'invited_org_id') IS NOT NULL
     AND btrim(NEW.raw_user_meta_data->>'invited_org_id') <> '' THEN
    BEGIN
      invite_org_id := (NEW.raw_user_meta_data->>'invited_org_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      invite_org_id := NULL;
    END;
  END IF;

  IF invite_org_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.orgs WHERE id = invite_org_id) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = invite_org_id AND m.user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_memberships (org_id, user_id, role)
  VALUES (invite_org_id, NEW.id, 'member');

  UPDATE public.profiles SET active_org_id = invite_org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_invited_workspace_confirm ON auth.users;
CREATE TRIGGER on_auth_user_invited_workspace_confirm
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.finish_invited_workspace_join();

-- -----------------------------------------------------------------------------
-- Pending org invites + auth lookup by email
-- Apply: supabase/migrations/202604101600_org_pending_invites_and_auth_lookup.sql
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_auth_user_for_invite(check_email text)
RETURNS TABLE (user_id uuid, user_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id,
         COALESCE(u.email, '')
  FROM auth.users u
  WHERE lower(btrim(u.email)) = lower(btrim(check_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_user_for_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auth_user_for_invite(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.org_pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_pending_invites_org_email_lower UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_pending_invites_org ON public.org_pending_invites(org_id);

ALTER TABLE public.org_pending_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view pending invites for their workspace" ON public.org_pending_invites;
CREATE POLICY "Org members can view pending invites for their workspace"
  ON public.org_pending_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = org_pending_invites.org_id
        AND m.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.clear_org_pending_invite_on_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_email text;
BEGIN
  SELECT lower(btrim(p.email)) INTO member_email
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF member_email IS NOT NULL AND member_email <> '' THEN
    DELETE FROM public.org_pending_invites pi
    WHERE pi.org_id = NEW.org_id
      AND lower(btrim(pi.email)) = member_email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_org_pending_on_membership ON public.org_memberships;
CREATE TRIGGER trg_clear_org_pending_on_membership
  AFTER INSERT ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_org_pending_invite_on_membership();

-- Apply: supabase/migrations/202604111300_org_member_join_owner_notify_queue.sql

CREATE TABLE IF NOT EXISTS public.org_member_join_notify_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_member_join_notify_queue_org_member UNIQUE (org_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_member_join_notify_queue_created
  ON public.org_member_join_notify_queue (created_at);

ALTER TABLE public.org_member_join_notify_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.queue_org_member_join_owner_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM 'member' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.org_member_join_notify_queue (org_id, member_user_id)
  VALUES (NEW.org_id, NEW.user_id)
  ON CONFLICT (org_id, member_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_org_member_join_notify ON public.org_memberships;
CREATE TRIGGER trg_queue_org_member_join_notify
  AFTER INSERT ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_org_member_join_owner_notify();

-- Apply: supabase/migrations/202604121200_data_sources_org_id.sql

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.data_sources ds
SET org_id = COALESCE(
  (SELECT p.active_org_id FROM public.profiles p WHERE p.id = ds.user_id),
  (
    SELECT om.org_id
    FROM public.org_memberships om
    WHERE om.user_id = ds.user_id
    ORDER BY om.created_at ASC
    LIMIT 1
  )
)
WHERE org_id IS NULL;

UPDATE public.data_sources ds
SET org_id = (
  SELECT om.org_id
  FROM public.org_memberships om
  WHERE om.user_id = ds.user_id
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE org_id IS NULL;

UPDATE public.transactions t
SET data_source_id = NULL
WHERE t.data_source_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.data_sources ds WHERE ds.id = t.data_source_id AND ds.org_id IS NULL);

DELETE FROM public.data_sources WHERE org_id IS NULL;

ALTER TABLE public.data_sources
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_sources_org_id ON public.data_sources (org_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_org_user ON public.data_sources (org_id, user_id);

DROP INDEX IF EXISTS public.idx_data_sources_user_fc_account;
CREATE UNIQUE INDEX idx_data_sources_org_user_fc_account
  ON public.data_sources (org_id, user_id, financial_connections_account_id)
  WHERE financial_connections_account_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can manage own data sources" ON public.data_sources;
CREATE POLICY "Users manage data sources in their orgs"
  ON public.data_sources FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = data_sources.org_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = data_sources.org_id
        AND m.user_id = auth.uid()
    )
  );
