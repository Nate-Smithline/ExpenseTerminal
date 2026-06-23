-- Prevent duplicate bank-feed transaction codes within a user workspace.
--
-- Existing databases may already contain duplicates, so remove them before
-- adding the constraint. This matches scripts/remove-duplicate-data-feed-
-- transactions.sql: keep one row per (user_id, data_feed_external_id), preferring
-- rows with budget assignments, then reviewed rows, then freshest rows.

CREATE TABLE IF NOT EXISTS public.deleted_transactions (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot        JSONB NOT NULL,
  budget_line_id  UUID,
  vendor          TEXT,
  amount          DECIMAL(12, 2),
  date            DATE,
  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TABLE IF EXISTS pg_temp.duplicate_data_feed_transactions_to_remove;
DROP TABLE IF EXISTS pg_temp.affected_duplicate_data_sources;

CREATE TEMP TABLE duplicate_data_feed_transactions_to_remove AS
WITH ranked AS (
  SELECT
    t.id,
    t.user_id,
    t.data_source_id,
    t.data_feed_external_id,
    t.updated_at,
    t.created_at,
    FIRST_VALUE(t.id) OVER duplicate_group AS keep_id,
    ROW_NUMBER() OVER duplicate_group AS duplicate_rank
  FROM public.transactions t
  LEFT JOIN public.budget_line_transactions blt
    ON blt.transaction_id = t.id
  WHERE t.data_feed_external_id IS NOT NULL
  WINDOW duplicate_group AS (
    PARTITION BY t.user_id, t.data_feed_external_id
    ORDER BY
      (blt.id IS NOT NULL) DESC,
      CASE t.status
        WHEN 'completed' THEN 4
        WHEN 'auto_sorted' THEN 3
        WHEN 'personal' THEN 2
        ELSE 1
      END DESC,
      t.updated_at DESC NULLS LAST,
      t.created_at DESC NULLS LAST,
      t.id
  )
)
SELECT
  id AS duplicate_id,
  keep_id,
  user_id,
  data_source_id,
  data_feed_external_id,
  updated_at,
  created_at
FROM ranked
WHERE duplicate_rank > 1;

CREATE TEMP TABLE affected_duplicate_data_sources AS
SELECT DISTINCT data_source_id AS id
FROM duplicate_data_feed_transactions_to_remove
WHERE data_source_id IS NOT NULL;

INSERT INTO public.deleted_transactions (
  id,
  user_id,
  snapshot,
  budget_line_id,
  vendor,
  amount,
  date,
  deleted_at
)
SELECT
  t.id,
  t.user_id,
  to_jsonb(t),
  blt.budget_line_id,
  t.vendor,
  t.amount,
  t.date,
  NOW()
FROM public.transactions t
JOIN duplicate_data_feed_transactions_to_remove d
  ON d.duplicate_id = t.id
LEFT JOIN public.budget_line_transactions blt
  ON blt.transaction_id = t.id
ON CONFLICT (id) DO NOTHING;

WITH keeper_assignments AS (
  SELECT DISTINCT blt.transaction_id AS keep_id
  FROM public.budget_line_transactions blt
  JOIN duplicate_data_feed_transactions_to_remove d
    ON d.keep_id = blt.transaction_id
),
movable_assignments AS (
  SELECT
    blt.id AS budget_line_transaction_id,
    d.keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY d.keep_id
      ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.duplicate_id
    ) AS assignment_rank
  FROM duplicate_data_feed_transactions_to_remove d
  JOIN public.budget_line_transactions blt
    ON blt.transaction_id = d.duplicate_id
  LEFT JOIN keeper_assignments existing
    ON existing.keep_id = d.keep_id
  WHERE existing.keep_id IS NULL
)
UPDATE public.budget_line_transactions blt
SET transaction_id = movable.keep_id
FROM movable_assignments movable
WHERE blt.id = movable.budget_line_transaction_id
  AND movable.assignment_rank = 1;

DELETE FROM public.transactions t
USING duplicate_data_feed_transactions_to_remove d
WHERE t.id = d.duplicate_id;

UPDATE public.data_sources ds
SET transaction_count = (
  SELECT COUNT(*)
  FROM public.transactions t
  WHERE t.data_source_id = ds.id
)
WHERE ds.id IN (SELECT id FROM affected_duplicate_data_sources);

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_user_data_feed_external_key;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_data_feed_external_key
  UNIQUE (user_id, data_feed_external_id);
