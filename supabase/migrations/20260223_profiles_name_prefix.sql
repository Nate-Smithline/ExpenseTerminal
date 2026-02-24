-- Add name prefix (Mr., Mrs., Dr., etc.) to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name_prefix TEXT;
