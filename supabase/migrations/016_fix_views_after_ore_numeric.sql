-- ============================================================
-- Migration 016: Ricrea corsi_con_ore e progetti_con_stats
--               dopo il cambio sessioni.ore INTEGER → NUMERIC(4,2)
-- ============================================================
--
-- PROBLEMA: migration 015 ha cambiato sessioni.ore da INTEGER a NUMERIC(4,2).
-- Questo ha invalidato corsi_con_ore perché:
--   - il vecchio SUM(ore) produceva ore_pianificate BIGINT
--   - il nuovo SUM(ore) produce ore_pianificate NUMERIC(4,2)
--
-- CREATE OR REPLACE VIEW rifiuta il cambio di tipo su colonne già esistenti,
-- quindi lo step 5 della migration 015 ha fallito silenziosamente, lasciando
-- corsi_con_ore in stato invalido.
--
-- progetti_con_stats dipende da corsi_con_ore → anch'essa invalida.
-- Supabase PostgREST restituisce null invece di un errore leggibile →
-- i progetti non appaiono nella UI anche se i dati ci sono.
--
-- FIX: DROP con CASCADE + CREATE (stesso pattern usato in migration 006 e 010).
-- ============================================================

-- 1. Drop entrambe le view (CASCADE gestisce le dipendenze interne)
DROP VIEW IF EXISTS progetti_con_stats CASCADE;
DROP VIEW IF EXISTS corsi_con_ore CASCADE;

-- 2. Ricrea corsi_con_ore con il tipo corretto per ore_pianificate
CREATE VIEW corsi_con_ore AS
SELECT
  c.*,
  COALESCE(SUM(s.ore), 0)                                           AS ore_pianificate,
  c.ore_totali - COALESCE(SUM(s.ore), 0)                           AS ore_residue,
  CASE WHEN COALESCE(SUM(s.ore), 0) >= c.ore_totali
       THEN true ELSE false END                                      AS calendario_completo
FROM corsi c
LEFT JOIN sessioni s ON s.corso_id = c.id
GROUP BY c.id;

-- 3. Ricrea progetti_con_stats (invariata rispetto alla migration 006,
--    usa LATERAL join su sessioni direttamente + join su corsi_con_ore
--    solo per il flag calendario_completo)
CREATE VIEW progetti_con_stats AS
SELECT
  p.*,
  COUNT(DISTINCT c.id)                                              AS n_corsi,
  COALESCE(SUM(c.ore_totali), 0)                                   AS ore_totali,
  COALESCE(SUM(sess_sum.ore_pianificate), 0)                       AS ore_pianificate,
  CASE
    WHEN COALESCE(SUM(c.ore_totali), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(sess_sum.ore_pianificate), 0)::NUMERIC /
       SUM(c.ore_totali)::NUMERIC) * 100, 1
    )
  END                                                               AS percentuale_completamento,
  COUNT(DISTINCT CASE WHEN c.formatore_id IS NULL THEN c.id END)   AS corsi_senza_formatore,
  COUNT(DISTINCT CASE WHEN co.calendario_completo = false
                       AND c.formatore_id IS NOT NULL THEN c.id END) AS corsi_senza_calendario,
  COALESCE(SUM(CASE WHEN c.tutor_previsto THEN c.ore_tutoraggio ELSE 0 END), 0)
                                                                    AS ore_tutoraggio_totali,
  COALESCE(SUM(
    CASE WHEN c.tutor_previsto AND c.ore_tutoraggio IS NOT NULL AND c.ore_totali > 0
    THEN ROUND(
      c.ore_tutoraggio::NUMERIC *
      (COALESCE(sess_sum.ore_pianificate, 0)::NUMERIC / c.ore_totali::NUMERIC)
    )
    ELSE 0 END
  ), 0)                                                             AS ore_tutoraggio_pianificate
FROM progetti p
LEFT JOIN corsi c ON c.project_id = p.id
LEFT JOIN LATERAL (
  SELECT corso_id, COALESCE(SUM(ore), 0) AS ore_pianificate
  FROM sessioni
  WHERE corso_id = c.id
  GROUP BY corso_id
) sess_sum ON true
LEFT JOIN corsi_con_ore co ON co.id = c.id
GROUP BY p.id;
