-- Replace continuous/once with apply-to modes for org transaction rules.

ALTER TABLE public.org_transaction_rules
  DROP CONSTRAINT IF EXISTS org_transaction_rules_trigger_mode_check;

UPDATE public.org_transaction_rules
  SET trigger_mode = 'new_and_existing'
  WHERE trigger_mode = 'continuous';

UPDATE public.org_transaction_rules
  SET trigger_mode = 'existing_only',
      once_completed_at = NULL
  WHERE trigger_mode = 'once';

ALTER TABLE public.org_transaction_rules
  ALTER COLUMN trigger_mode SET DEFAULT 'new_and_existing';

ALTER TABLE public.org_transaction_rules
  ADD CONSTRAINT org_transaction_rules_trigger_mode_check
  CHECK (trigger_mode IN ('new_and_existing', 'new_only', 'existing_only'));
