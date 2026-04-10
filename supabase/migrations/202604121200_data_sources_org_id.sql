-- Scope bank/manual accounts to a single workspace (org).

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

-- Rows with no resolvable org (orphan) — attach to user's first membership if any remains null
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

-- No membership / profile edge case: remove orphaned sources so NOT NULL is safe
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
