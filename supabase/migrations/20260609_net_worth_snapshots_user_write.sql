-- Allow authenticated users to upsert their own balance snapshots (one row per account per day).

CREATE POLICY "Users insert own net_worth_snapshots"
  ON public.net_worth_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own net_worth_snapshots"
  ON public.net_worth_snapshots
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
