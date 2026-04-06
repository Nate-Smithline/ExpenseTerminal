-- =============================================================================
-- AUTHENTICATION (Supabase Auth)
-- =============================================================================
-- Login and signup use Supabase Auth. Credentials (email/password) are stored
-- in auth.users (managed by Supabase). Your app calls:
--   - supabase.auth.signInWithPassword({ email, password }) for login
--   - supabase.auth.signUp({ email, password }) for signup
-- RLS on all tables below uses auth.uid() so each user only sees their own data.
--
-- Optional: profiles table for display name/avatar, synced when a user signs up.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  email_opt_in BOOLEAN DEFAULT false,
  notification_email_updates BOOLEAN DEFAULT false,
  notification_group BOOLEAN DEFAULT false,
  onboarding_progress JSONB DEFAULT '{}',
  terms_accepted_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if upgrading existing DB
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_email_updates BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_group BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_progress JSONB DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- When a new user signs up (insert into auth.users), create a profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- APPLICATION TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'checking',
  institution TEXT,
  -- Source type & Stripe metadata
  source_type TEXT NOT NULL DEFAULT 'manual',
  stripe_account_id TEXT,
  financial_connections_account_id TEXT,
  connected_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  last_failed_sync_at TIMESTAMPTZ,
  last_error_summary TEXT,
  last_upload_at TIMESTAMPTZ,
  transaction_count INTEGER DEFAULT 0,
  stripe_sync_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sources_user ON public.data_sources(user_id);

-- Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,

  -- Transaction data
  date DATE NOT NULL,
  vendor TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,

  -- AI categorization
  category TEXT,
  schedule_c_line TEXT,
  ai_confidence DECIMAL(3, 2),
  ai_reasoning TEXT,
  ai_suggestions JSONB,

  -- User review status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'personal', 'auto_sorted')),
  business_purpose TEXT,
  quick_label TEXT,
  notes TEXT,

  -- Matching & auto-sort
  vendor_normalized TEXT,
  auto_sort_rule_id UUID,

  -- Deduction
  deduction_percent INTEGER DEFAULT 100,

  -- Metadata
  is_meal BOOLEAN DEFAULT false,
  is_travel BOOLEAN DEFAULT false,
  tax_year INTEGER NOT NULL,
  source TEXT DEFAULT 'csv_upload',
  transaction_type TEXT DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'income')),
  data_source_id UUID REFERENCES public.data_sources(id),
  data_feed_external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if upgrading existing DB (run once)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'expense';
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check CHECK (transaction_type IN ('expense', 'income'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deduction_percent INTEGER DEFAULT 100;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.data_sources(id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_normalized ON public.transactions(vendor_normalized);
CREATE INDEX IF NOT EXISTS idx_transactions_tax_year ON public.transactions(tax_year);
CREATE INDEX IF NOT EXISTS idx_transactions_data_source ON public.transactions(data_source_id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_feed_external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_data_feed_external
  ON public.transactions(data_source_id, data_feed_external_id)
  WHERE data_feed_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_year_status_type ON public.transactions(user_id, tax_year, status, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Auto-sort rules
CREATE TABLE IF NOT EXISTS public.auto_sort_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vendor_pattern TEXT NOT NULL,
  quick_label TEXT NOT NULL,
  business_purpose TEXT,
  category TEXT,
  -- Generalized rules engine fields
  name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_sort_rules_user ON public.auto_sort_rules(user_id);

-- Deductions
CREATE TABLE IF NOT EXISTS public.deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  tax_savings DECIMAL(12, 2) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deductions_user_year ON public.deductions(user_id, tax_year);

-- Vendor patterns cache (for AI cost reduction)
CREATE TABLE IF NOT EXISTS public.vendor_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vendor_normalized TEXT NOT NULL,
  category TEXT,
  schedule_c_line TEXT,
  deduction_percent INTEGER DEFAULT 100,
  quick_labels JSONB,
  confidence DECIMAL(3, 2),
  times_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vendor_normalized)
);

CREATE INDEX IF NOT EXISTS idx_vendor_patterns_user ON public.vendor_patterns(user_id, vendor_normalized);

-- Orgs (multi-org model)
CREATE TABLE IF NOT EXISTS public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Organization',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);

-- Org-wide custom columns for activity transactions (Notion-style properties)
CREATE TABLE IF NOT EXISTS public.transaction_property_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transaction_property_definitions_type_check CHECK (type IN (
    'multi_select',
    'select',
    'date',
    'short_text',
    'long_text',
    'checkbox',
    'org_user',
    'number',
    'files',
    'phone',
    'email',
    'created_time',
    'created_by',
    'last_edited_date',
    'last_edited_time'
  ))
);

CREATE INDEX IF NOT EXISTS idx_transaction_property_definitions_org
  ON public.transaction_property_definitions(org_id, position);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_org_id UUID REFERENCES public.orgs(id);

-- Org settings (business profile)
CREATE TABLE IF NOT EXISTS public.org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  business_name TEXT,
  ein TEXT,
  business_address TEXT,
  business_address_line1 TEXT,
  business_address_line2 TEXT,
  business_city TEXT,
  business_state TEXT,
  business_zip TEXT,
  filing_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backwards-compatible column adds for existing databases
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS business_address_line1 TEXT;
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS business_address_line2 TEXT;
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS business_city TEXT;
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS business_state TEXT;
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS business_zip TEXT;

-- Tax year settings (per-year tax rate)
CREATE TABLE IF NOT EXISTS public.tax_year_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tax_year INTEGER NOT NULL,
  tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.24,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tax_year)
);

CREATE INDEX IF NOT EXISTS idx_tax_year_settings_user ON public.tax_year_settings(user_id, tax_year);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_sort_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_year_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_property_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view transaction property definitions"
  ON public.transaction_property_definitions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert transaction property definitions"
  ON public.transaction_property_definitions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update transaction property definitions"
  ON public.transaction_property_definitions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete transaction property definitions"
  ON public.transaction_property_definitions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own rules"
  ON public.auto_sort_rules FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own deductions"
  ON public.deductions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own vendor patterns"
  ON public.vendor_patterns FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own data sources"
  ON public.data_sources FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own org settings"
  ON public.org_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tax year settings"
  ON public.tax_year_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view orgs they belong to"
  ON public.orgs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update orgs they own"
  ON public.orgs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = id AND m.user_id = auth.uid() AND m.role = 'owner'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = id AND m.user_id = auth.uid() AND m.role = 'owner'
  ));

CREATE POLICY "Users can view own memberships"
  ON public.org_memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Org owners can manage memberships"
  ON public.org_memberships FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_memberships.org_id AND m.user_id = auth.uid() AND m.role = 'owner'
  ));

-- =============================================================================
-- NOTIFICATION PREFERENCES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('count_based', 'interval_based')),
  value TEXT NOT NULL,
  last_notified_at TIMESTAMPTZ,
  last_counter_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Backwards-compatible column adds for existing databases
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS financial_connections_account_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_failed_sync_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_error_summary TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS stripe_sync_start_date DATE;

-- One data source per Stripe FC account per user (block duplicate links).
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_sources_user_fc_account
  ON public.data_sources(user_id, financial_connections_account_id)
  WHERE financial_connections_account_id IS NOT NULL;

ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS action JSONB NOT NULL DEFAULT '{}'::jsonb;

-- =============================================================================
-- EMAIL VERIFICATIONS (Bible-word tokens)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON public.email_verifications(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON public.email_verifications(user_id);

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Service role manages verifications; users can read their own
CREATE POLICY "Users can view own verifications"
  ON public.email_verifications FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- BILLING & SUBSCRIPTIONS
-- =============================================================================

-- Subscriptions are keyed by user_id, which serves as the per-workspace/org identifier.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  plan TEXT CHECK (plan IN ('starter', 'plus')),
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON public.subscriptions(stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Track whether a transaction is eligible to be sent to AI under the user's plan.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS eligible_for_ai BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_transactions_ai_eligibility
  ON public.transactions(user_id, source, eligible_for_ai);

-- Saved activity pages (pages, page_members, page_favorites, RLS, peer profile reads):
-- see migration 202604031200_pages_sharing_favorites.sql