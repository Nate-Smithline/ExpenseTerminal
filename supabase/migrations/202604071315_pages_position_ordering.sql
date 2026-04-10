-- Pages: add stable sidebar ordering via `position`.
-- Used by /api/pages and Sidebar drag-and-drop reorder.

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows to a deterministic order (newest updated first).
-- Use big gaps (×1000) so future inserts can go "between" without rewriting all rows.
WITH ranked AS (
  SELECT
    id,
    org_id,
    (ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY updated_at DESC, created_at DESC, id) - 1) * 1000 AS pos
  FROM public.pages
  WHERE deleted_at IS NULL
)
UPDATE public.pages p
SET position = r.pos
FROM ranked r
WHERE p.id = r.id;

CREATE INDEX IF NOT EXISTS idx_pages_org_position
  ON public.pages(org_id, position)
  WHERE deleted_at IS NULL;

