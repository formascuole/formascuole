-- ============================================================
-- Migration 009: Rendi anno_scolastico nullable in progetti
-- ============================================================
-- anno_scolastico era NOT NULL ma è opzionale: il progetto ora
-- usa finanziamento_id come campo principale di categorizzazione.
-- Eseguire nel Supabase SQL Editor.
-- ============================================================

ALTER TABLE progetti
  ALTER COLUMN anno_scolastico DROP NOT NULL;
