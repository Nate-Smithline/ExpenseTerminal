-- Card-required free trial: track when the "your trial is ending" reminder
-- email was sent so the daily cron never emails the same trial twice.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ending_email_sent_at TIMESTAMPTZ;

-- Helps the cron quickly find trialing subscriptions whose trial is ending soon.
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ending
  ON public.subscriptions(status, current_period_end)
  WHERE status = 'trialing';
