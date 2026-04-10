-- Org-wide transaction automation rules (conditions + actions JSON).
-- Execution resolves transactions via org_memberships (transactions remain user-scoped).

CREATE TABLE IF NOT EXISTS public.org_transaction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled rule',
  enabled BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  conditions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_mode TEXT NOT NULL DEFAULT 'continuous'
    CHECK (trigger_mode IN ('continuous', 'once')),
  once_completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_transaction_rules_org
  ON public.org_transaction_rules(org_id, position, created_at);

CREATE TABLE IF NOT EXISTS public.org_transaction_rule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  rule_id UUID NULL REFERENCES public.org_transaction_rules(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  match_count INTEGER NOT NULL DEFAULT 0,
  update_count INTEGER NOT NULL DEFAULT 0,
  ai_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_org_transaction_rule_runs_org_started
  ON public.org_transaction_rule_runs(org_id, started_at DESC);

ALTER TABLE public.org_transaction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_transaction_rule_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view org transaction rules"
  ON public.org_transaction_rules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rules.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert org transaction rules"
  ON public.org_transaction_rules FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rules.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update org transaction rules"
  ON public.org_transaction_rules FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rules.org_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rules.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete org transaction rules"
  ON public.org_transaction_rules FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rules.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can view org transaction rule runs"
  ON public.org_transaction_rule_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rule_runs.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert org transaction rule runs"
  ON public.org_transaction_rule_runs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rule_runs.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update org transaction rule runs"
  ON public.org_transaction_rule_runs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rule_runs.org_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_transaction_rule_runs.org_id AND m.user_id = auth.uid()
  ));
