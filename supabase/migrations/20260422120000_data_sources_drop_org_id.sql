-- Remove org_id from data_sources: drop RLS policies that reference it first, then the column.
-- Recreate workspace membership policies so the table stays usable (matches workspaces MVP).

-- Policies that depend on data_sources.org_id (names from Supabase / custom migrations)
DROP POLICY IF EXISTS data_sources_select_org_rules ON public.data_sources;
DROP POLICY IF EXISTS data_sources_insert_own ON public.data_sources;
DROP POLICY IF EXISTS data_sources_update_own ON public.data_sources;
DROP POLICY IF EXISTS data_sources_delete_own ON public.data_sources;

-- Policies on other tables that reference data_sources.org_id
DROP POLICY IF EXISTS transactions_select_org_data_sources ON public.transactions;

ALTER TABLE public.data_sources DROP COLUMN IF EXISTS org_id;

-- App uses workspace_id + workspace_members (see 20260420065156_workspaces_mvp.sql)
DROP POLICY IF EXISTS "Data sources: members can manage" ON public.data_sources;
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

DROP POLICY IF EXISTS "Transactions: members can manage" ON public.transactions;
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
