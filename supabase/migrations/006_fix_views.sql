-- ============================================================
-- Migration 006: Ricrea corsi_con_ore includendo le colonne
--               aggiunte nelle migration 003, 004 e 005
-- ============================================================
--
-- PROBLEMA: la view corsi_con_ore è stata creata/ricreata l'ultima volta
-- nella migration 002. Le migration successive hanno aggiunto colonne a
-- "corsi" ma non hanno ricreato la view. Risultato: la view non espone:
--   - tutor_id            (aggiunta in 003)
--   - referente_id        (aggiunta in 004)
--   - stato_assegnazione  (aggiunta in 005)
--   - accettazione_richiesta_at, accettazione_risposta_at, rifiuto_motivazione (005)
--
-- Questo causava:
--   1. Badge stato_assegnazione mai visibile nella lista corsi
--   2. tutor_id sempre NULL dopo page refresh → tutor_id appariva non salvato
--   3. referente_id sempre NULL dopo page refresh
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

-- Ricrea anche progetti_con_stats per sicurezza (dipende da corsi_con_ore)
CREATE OR REPLACE VIEW progetti_con_stats AS
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
