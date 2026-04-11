-- Allow org members to UPDATE transactions tied to org data_sources under the same
-- rules as transactions_select_org_data_sources (owner role or accounts_page_visibility = 'org').
-- Owners may still update their own rows via transactions_update_own.

DROP POLICY IF EXISTS "transactions_update_org_data_sources" ON public.transactions;

CREATE POLICY "transactions_update_org_data_sources"
  ON public.transactions FOR UPDATE
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
  )
  WITH CHECK (
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
