-- Workspaces MVP: multi-entity support + membership-based RLS
--
-- Strategy:
-- - Add workspaces + workspace_members
-- - Add workspace_id columns to core tables (transactions, data_sources, deductions, vendor_patterns)
-- - Backfill: create a default workspace per user and attach existing rows
-- - Update RLS from user_id-based to workspace membership-based

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_type TEXT,
  tax_filing_status TEXT,
  fiscal_year_start INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- ---------------------------------------------------------------------------
-- Columns: workspace_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

ALTER TABLE public.deductions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

ALTER TABLE public.vendor_patterns
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_data_sources_workspace ON public.data_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON public.transactions(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_deductions_workspace_year ON public.deductions(workspace_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_vendor_patterns_workspace ON public.vendor_patterns(workspace_id);

-- ---------------------------------------------------------------------------
-- Backfill: default workspace per user + attach existing rows
-- ---------------------------------------------------------------------------

-- Create a default workspace per user and attach membership in one flow.
WITH users_with_data AS (
  SELECT DISTINCT user_id FROM public.transactions
  UNION
  SELECT DISTINCT user_id FROM public.data_sources
  UNION
  SELECT DISTINCT user_id FROM public.deductions
  UNION
  SELECT DISTINCT user_id FROM public.vendor_patterns
), user_names AS (
  SELECT p.id AS user_id,
         NULLIF(TRIM(COALESCE(p.display_name, CONCAT_WS(' ', p.first_name, p.last_name))), '') AS display_name,
         NULLIF(TRIM(COALESCE(p.email, '')), '') AS email
  FROM public.profiles p
), to_create AS (
  SELECT
    u.user_id,
    gen_random_uuid() AS workspace_id,
    COALESCE(un.display_name, un.email, 'My workspace') AS workspace_name
  FROM users_with_data u
  LEFT JOIN user_names un ON un.user_id = u.user_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.user_id = u.user_id
  )
), created AS (
  INSERT INTO public.workspaces (id, name)
  SELECT workspace_id, workspace_name FROM to_create
  RETURNING id
)
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT tc.workspace_id, tc.user_id, 'owner'
FROM to_create tc
JOIN created c ON c.id = tc.workspace_id;

-- Backfill workspace_id on existing rows (use membership workspace)
UPDATE public.transactions t
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE t.workspace_id IS NULL
  AND wm.user_id = t.user_id;

UPDATE public.data_sources s
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE s.workspace_id IS NULL
  AND wm.user_id = s.user_id;

UPDATE public.deductions d
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE d.workspace_id IS NULL
  AND wm.user_id = d.user_id;

UPDATE public.vendor_patterns v
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE v.workspace_id IS NULL
  AND wm.user_id = v.user_id;

-- Enforce NOT NULL (after backfill). If any rows remain null, leave nullable to avoid bricking migrations.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.transactions WHERE workspace_id IS NULL) THEN
    RAISE NOTICE 'transactions.workspace_id still NULL for some rows; leaving nullable';
  ELSE
    ALTER TABLE public.transactions ALTER COLUMN workspace_id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.data_sources WHERE workspace_id IS NULL) THEN
    RAISE NOTICE 'data_sources.workspace_id still NULL for some rows; leaving nullable';
  ELSE
    ALTER TABLE public.data_sources ALTER COLUMN workspace_id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.deductions WHERE workspace_id IS NULL) THEN
    RAISE NOTICE 'deductions.workspace_id still NULL for some rows; leaving nullable';
  ELSE
    ALTER TABLE public.deductions ALTER COLUMN workspace_id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.vendor_patterns WHERE workspace_id IS NULL) THEN
    RAISE NOTICE 'vendor_patterns.workspace_id still NULL for some rows; leaving nullable';
  ELSE
    ALTER TABLE public.vendor_patterns ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: membership-based (workspace_members)
-- ---------------------------------------------------------------------------

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces are visible to members; insert allowed via service role or via explicit API.
DROP POLICY IF EXISTS "Workspaces: members can view" ON public.workspaces;
CREATE POLICY "Workspaces: members can view"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace members: view own memberships" ON public.workspace_members;
CREATE POLICY "Workspace members: view own memberships"
  ON public.workspace_members FOR SELECT
  USING (user_id = auth.uid());

-- Helper predicate: membership check inline for each table
-- Update per-table policies to membership-based. We drop the old user_id policies by name where known.

-- transactions
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Transactions: members can manage"
  ON public.transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = transactions.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = transactions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- data_sources
DROP POLICY IF EXISTS "Users can manage own data_sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can manage own data sources" ON public.data_sources;

CREATE POLICY "Data sources: members can manage"
  ON public.data_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = data_sources.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = data_sources.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- deductions
DROP POLICY IF EXISTS "Users can manage own deductions" ON public.deductions;

CREATE POLICY "Deductions: members can manage"
  ON public.deductions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = deductions.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = deductions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- vendor_patterns
DROP POLICY IF EXISTS "Users can manage own vendor patterns" ON public.vendor_patterns;
DROP POLICY IF EXISTS "Users can manage own vendor_patterns" ON public.vendor_patterns;

CREATE POLICY "Vendor patterns: members can manage"
  ON public.vendor_patterns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = vendor_patterns.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = vendor_patterns.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

