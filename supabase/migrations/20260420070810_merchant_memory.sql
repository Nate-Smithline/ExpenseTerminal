-- Merchant memory table (workspace-scoped) per spec.

CREATE TABLE IF NOT EXISTS public.merchant_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  raw_name_pattern TEXT NOT NULL,
  display_name TEXT NOT NULL,
  default_category TEXT,
  default_deduction_type TEXT,
  default_likelihood TEXT,
  source TEXT NOT NULL,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  corrected_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, raw_name_pattern)
);

CREATE INDEX IF NOT EXISTS idx_merchant_memory_workspace_pattern
  ON public.merchant_memory (workspace_id, raw_name_pattern);

ALTER TABLE public.merchant_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchant memory: members can manage" ON public.merchant_memory;
CREATE POLICY "Merchant memory: members can manage"
  ON public.merchant_memory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = merchant_memory.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = merchant_memory.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

