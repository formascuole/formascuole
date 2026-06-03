-- ============================================================
-- Migration 018: Stato completamento corso + tariffa oraria
-- ============================================================
-- Aggiunge a corsi:
--   corso_completato      → il formatore ha dichiarato il corso concluso
--   corso_completato_at   → timestamp della dichiarazione
--   tariffa_oraria        → tariffa oraria del formatore (visibile admin)
-- ============================================================

ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS corso_completato     boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS corso_completato_at  timestamptz,
  ADD COLUMN IF NOT EXISTS tariffa_oraria       numeric(10,2);
