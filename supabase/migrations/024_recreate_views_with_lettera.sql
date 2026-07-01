-- Recreate corsi_con_ore and progetti_con_stats so that c.* expands to include
-- all lettera_incarico_* and lettera_tutor_* columns added after the view was
-- last recreated.  PostgreSQL views freeze their column list at CREATE time;
-- DROP + CREATE is required to pick up new table columns.

DROP VIEW IF EXISTS corsi_con_ore CASCADE;
DROP VIEW IF EXISTS progetti_con_stats CASCADE;

-- ── corsi_con_ore ─────────────────────────────────────────────────────────────
CREATE VIEW corsi_con_ore AS
SELECT
  c.*,
  COALESCE(SUM(s.ore), 0)                                                        AS ore_pianificate,
  COALESCE(SUM(CASE WHEN s.completata = true THEN s.ore ELSE 0 END), 0)          AS ore_erogate,
  c.ore_totali - COALESCE(SUM(s.ore), 0)                                         AS ore_residue,
  CASE WHEN COALESCE(SUM(s.ore), 0) >= c.ore_totali
       THEN true ELSE false END                                                   AS calendario_completo
FROM corsi c
LEFT JOIN sessioni s ON s.corso_id = c.id
GROUP BY c.id;

-- ── progetti_con_stats ────────────────────────────────────────────────────────
-- (CASCADE-dropped above; must be recreated)
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
