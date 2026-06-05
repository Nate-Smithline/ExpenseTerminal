-- ── Deleted transactions (recoverable trash) ─────────────────────────────────
-- Transactions are normally hard-deleted. To make deletes recoverable, the
-- delete endpoint first archives a full JSONB snapshot of the row (plus its
-- budget-line assignment, if any) here, then removes it from `transactions`.
-- Restore re-inserts the snapshot (preserving the original id) and re-links the
-- budget assignment when the line still exists. Read queries elsewhere are
-- untouched because the live row is gone — deleted rows only live in this table.

CREATE TABLE IF NOT EXISTS public.deleted_transactions (
  -- Same id as the original transaction so restore preserves references.
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Full snapshot of the transactions row at the moment of deletion.
  snapshot        JSONB NOT NULL,

  -- Prior budget-line assignment (so it can be restored). Nullable: most
  -- transactions are not assigned to a budget line.
  budget_line_id  UUID,

  -- Denormalized fields for listing/searching the trash without parsing JSON.
  vendor          TEXT,
  amount          DECIMAL(12, 2),
  date            DATE,

  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.deleted_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own deleted_transactions"
  ON public.deleted_transactions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deleted_transactions_user
  ON public.deleted_transactions(user_id, deleted_at DESC);
