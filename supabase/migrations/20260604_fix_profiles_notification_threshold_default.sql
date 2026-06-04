-- Fix profiles.notification_threshold default.
--
-- The column has a CHECK constraint (profiles_notification_threshold_check)
-- that only allows the values {20, 50, 100}, but its column DEFAULT was 5.
-- Any INSERT that does not explicitly set notification_threshold (including
-- the handle_new_user signup trigger and any upsert on the profiles table)
-- produces a row with notification_threshold = 5, which violates the
-- constraint and fails with SQLSTATE 23514. This realigns the default with
-- the constraint. Existing rows are unaffected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'notification_threshold'
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN notification_threshold SET DEFAULT 20;
  END IF;
END $$;
