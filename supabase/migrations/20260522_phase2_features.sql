-- =============================================================================
-- Phase 2: Tax intelligence widget, AI-suggested rules, mixed account flag
-- =============================================================================

-- ── W-2 income fields on tax_year_settings ────────────────────────────────────
-- Stored per tax year so the user can maintain separate W-2 data for each year.

ALTER TABLE public.tax_year_settings ADD COLUMN IF NOT EXISTS w2_gross_income DECIMAL(12, 2);
ALTER TABLE public.tax_year_settings ADD COLUMN IF NOT EXISTS w2_withholding_ytd DECIMAL(12, 2);

-- ── Mixed vs. purely business account flag ────────────────────────────────────
-- When true, the inbox auto-flags common personal categories as "Likely Personal".
-- Default false: all existing accounts treated as purely business until user updates.

ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS is_mixed_account BOOLEAN NOT NULL DEFAULT FALSE;
