-- ============================================================
-- Migration 010: Ricrea corsi_con_ore includendo le colonne
--               aggiunte nella migration 008 (catalogo corsi)
-- ============================================================
--
-- PROBLEMA: la view corsi_con_ore è stata ricreata in migration 006
-- usando SELECT c.*. In PostgreSQL le colonne di una view si congelano
-- al momento della creazione: le colonne aggiunte successivamente alla
-- tabella corsi NON vengono esposte dalla view finché non viene ricreata.
--
-- Migration 008 ha aggiunto alla tabella corsi:
--   - descrizione  (TEXT)
--   - link_scheda  (TEXT)
--
-- Questo causava:
--   1. CorsoDetailClient non mostrava il link Google Drive (link_scheda NULL)
--   2. ProgettoFormatoreClient non mostrava il link scheda
--   3. Il campo descrizione non veniva mai restituito dalla view
--
-- Eseguire nel Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE VIEW corsi_con_ore AS
SELECT
  c.*,
  COALESCE(SUM(s.ore), 0)                                           AS ore_pianificate,
  c.ore_totali - COALESCE(SUM(s.ore), 0)                           AS ore_residue,
  CASE WHEN COALESCE(SUM(s.ore), 0) >= c.ore_totali
       THEN true ELSE false END                                      AS calendario_completo
FROM corsi c
LEFT JOIN sessioni s ON s.corso_id = c.id
GROUP BY c.id;
