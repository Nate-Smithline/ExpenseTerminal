-- Set the data source named 'Amex Card' to Direct Feed (Stripe) type.
-- Run this once; safe to re-run (UPDATE affects 0 rows if name doesn't match).
-- If you have multiple "Amex Card" accounts (different users), add: AND user_id = 'your-user-uuid'
-- Note: This only changes the type. To pull transactions, connect the account via
-- Data Sources → Connect with Stripe (or Repair connection) for that card.
UPDATE public.data_sources
SET source_type = 'stripe'
WHERE name = 'Amex Card';
