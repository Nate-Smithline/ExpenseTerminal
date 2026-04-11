-- Allow org members to SELECT peers' data_sources when accounts_page_visibility = 'org';
-- owners always see all accounts in the org. INSERT/UPDATE/DELETE remain own-row only.
-- Also allow SELECT on transactions tied to org data_sources under the same rules (for Accounts stats / activity).

DROP POLICY IF EXISTS "data_sources_select_org_rules" ON public.data_sources;
DROP POLICY IF EXISTS "data_sources_insert_own" ON public.data_sources;
DROP POLICY IF EXISTS "data_sources_update_own" ON public.data_sources;
DROP POLICY IF EXISTS "data_sources_delete_own" ON public.data_sources;
DROP POLICY IF EXISTS "Users manage data sources in their orgs" ON public.data_sources;

CREATE POLICY "data_sources_select_org_rules"
  ON public.data_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = data_sources.org_id
        AND m.user_id = auth.uid()
    )
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1
        FROM public.org_memberships me
        JOIN public.orgs o ON o.id = data_sources.org_id
        WHERE me.user_id = auth.uid()
          AND me.org_id = data_sources.org_id
          AND (me.role = 'owner' OR o.accounts_page_visibility = 'org')
      )
    )
  );

CREATE POLICY "data_sources_insert_own"
  ON public.data_sources FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = data_sources.org_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "data_sources_update_own"
  ON public.data_sources FOR UPDATE
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

CREATE POLICY "data_sources_delete_own"
  ON public.data_sources FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = data_sources.org_id
        AND m.user_id = auth.uid()
    )
  );

-- Transactions: split FOR ALL so members can read (not write) workspace-linked txns.
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_org_data_sources" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;

CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_select_org_data_sources"
  ON public.transactions FOR SELECT
  USING (
    data_source_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.data_sources ds
      JOIN public.org_memberships m ON m.org_id = ds.org_id AND m.user_id = auth.uid()
      JOIN public.orgs o ON o.id = ds.org_id
      WHERE ds.id = transactions.data_source_id
        AND (m.role = 'owner' OR o.accounts_page_visibility = 'org')
    )
  );

CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_own"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_delete_own"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);
