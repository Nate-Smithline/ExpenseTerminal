-- Fix deductions RLS so INSERT is explicitly allowed (WITH CHECK).
-- Run this in Supabase SQL Editor if "Save QBI deduction" fails with a permission/RLS error.

DROP POLICY IF EXISTS "Users can manage own deductions" ON public.deductions;

CREATE POLICY "Users can manage own deductions"
  ON public.deductions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
