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

  -- Metadata
  is_meal BOOLEAN DEFAULT false,
  is_travel BOOLEAN DEFAULT false,
  tax_year INTEGER NOT NULL,
  source TEXT DEFAULT 'csv_upload',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_normalized ON public.transactions(vendor_normalized);
CREATE INDEX IF NOT EXISTS idx_transactions_tax_year ON public.transactions(tax_year);

-- Auto-sort rules
CREATE TABLE IF NOT EXISTS public.auto_sort_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vendor_pattern TEXT NOT NULL,
  quick_label TEXT NOT NULL,
  business_purpose TEXT,
  category TEXT,
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

-- Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_sort_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own rules"
  ON public.auto_sort_rules FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own deductions"
  ON public.deductions FOR ALL
  USING (auth.uid() = user_id);

