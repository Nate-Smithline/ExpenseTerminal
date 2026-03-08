-- =============================================================================
-- Validate database schema for Expense Terminal (sync, auto-sort, transactions)
-- Run in Supabase SQL Editor. You get ONE result set: check_name | status
-- Any row with status != 'ok' needs fixing (run ensure_db_up_to_date.sql).
-- =============================================================================

SELECT check_name, status FROM (
  SELECT 1 AS ord, 'transactions columns (sync + auto-sort)' AS check_name,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transactions'
        AND column_name IN ('data_source_id','data_feed_external_id','vendor_normalized','category','schedule_c_line','quick_label','business_purpose','auto_sort_rule_id','deduction_percent','status','updated_at')) >= 11
    THEN 'ok' ELSE 'missing' END AS status
  UNION ALL
  SELECT 2, 'transactions_data_feed_unique (sync upsert)',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint pc
      JOIN pg_class t ON t.oid = pc.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'transactions'
        AND pc.conname = 'transactions_data_feed_external_key' AND pc.contype = 'u'
    ) THEN 'ok' ELSE 'missing' END
  UNION ALL
  SELECT 3, 'auto_sort_rules columns',
    CASE WHEN (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'auto_sort_rules'
        AND column_name IN ('user_id','vendor_pattern','quick_label','business_purpose','category','conditions','action')) >= 7
    THEN 'ok' ELSE 'missing' END
) v
ORDER BY ord;
