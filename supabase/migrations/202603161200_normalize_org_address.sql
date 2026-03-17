-- Normalize organization address into structured fields
-- This migration is safe to run on existing databases.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS business_address_line1 TEXT;

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS business_address_line2 TEXT;

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS business_city TEXT;

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS business_state TEXT;

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS business_zip TEXT;

