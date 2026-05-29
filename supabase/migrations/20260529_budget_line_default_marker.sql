-- =============================================================================
-- Budget line default marker
-- Adds default_marker and default_business_pct to budget_lines so that any
-- transaction dragged onto the line automatically inherits the tag.
-- Safe to run multiple times (idempotent).
-- =============================================================================

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS default_marker TEXT
    CHECK (default_marker IN ('Business', 'Personal', 'Partial'));

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS default_business_pct SMALLINT DEFAULT 100
    CHECK (default_business_pct >= 0 AND default_business_pct <= 100);
