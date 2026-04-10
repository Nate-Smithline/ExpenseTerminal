-- Who can open Accounts & Data: whole org vs owners-only (restricted).
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS accounts_page_visibility TEXT NOT NULL DEFAULT 'org';

ALTER TABLE public.orgs DROP CONSTRAINT IF EXISTS orgs_accounts_page_visibility_check;
ALTER TABLE public.orgs ADD CONSTRAINT orgs_accounts_page_visibility_check
  CHECK (accounts_page_visibility IN ('org', 'restricted'));
