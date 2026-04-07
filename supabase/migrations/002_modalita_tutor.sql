-- ============================================================
-- Migration 002: modalità erogazione, tutor, e formatori via app
-- Esegui questo intero script nel Supabase SQL Editor
-- ============================================================

-- 1. Nuovi enum types
CREATE TYPE modalita_corso AS ENUM ('presenza', 'online', 'ibrido');
CREATE TYPE modalita_sessione_tipo AS ENUM ('presenza', 'online');

-- 2. Colonne su corsi
ALTER TABLE corsi
  ADD COLUMN modalita modalita_corso,             -- obbligatoria solo per PF (enforced lato app)
  ADD COLUMN tutor_previsto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tutor_nome TEXT,
  ADD COLUMN ore_tutoraggio INTEGER;              -- ore di tutoraggio previste (nullable)

-- 3. Colonna su sessioni
ALTER TABLE sessioni
  ADD COLUMN modalita_sessione modalita_sessione_tipo;  -- obbligatoria solo per corsi ibridi (enforced lato app)

-- 4. Aggiorna la view corsi_con_ore per includere i nuovi campi
CREATE OR REPLACE VIEW corsi_con_ore AS
SELECT
  c.*,
  COALESCE(SUM(s.ore), 0)                                          AS ore_pianificate,
  c.ore_totali - COALESCE(SUM(s.ore), 0)                          AS ore_residue,
  CASE WHEN COALESCE(SUM(s.ore), 0) >= c.ore_totali
       THEN true ELSE false END                                     AS calendario_completo
FROM corsi c
LEFT JOIN sessioni s ON s.corso_id = c.id
GROUP BY c.id;

-- 5. Aggiorna la view progetti_con_stats (nessuna modifica strutturale necessaria,
--    ma ricrea per essere sicuri che includa i nuovi campi di corsi)
CREATE OR REPLACE VIEW progetti_con_stats AS
SELECT
  p.*,
  COUNT(DISTINCT c.id)                                             AS n_corsi,
  COALESCE(SUM(c.ore_totali), 0)                                  AS ore_totali,
  COALESCE(SUM(sess_sum.ore_pianificate), 0)                      AS ore_pianificate,
  CASE
    WHEN COALESCE(SUM(c.ore_totali), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(sess_sum.ore_pianificate), 0)::NUMERIC /
       SUM(c.ore_totali)::NUMERIC) * 100, 1
    )
  END                                                              AS percentuale_completamento,
  COUNT(DISTINCT CASE WHEN c.formatore_id IS NULL THEN c.id END)  AS corsi_senza_formatore,
  COUNT(DISTINCT CASE WHEN co.calendario_completo = false
                       AND c.formatore_id IS NOT NULL THEN c.id END) AS corsi_senza_calendario,
  -- Statistiche tutoraggio
  COALESCE(SUM(CASE WHEN c.tutor_previsto THEN c.ore_tutoraggio ELSE 0 END), 0)
                                                                   AS ore_tutoraggio_totali,
  -- Ore tutoraggio "pianificate" = proporzionale al completamento del corso
  COALESCE(SUM(
    CASE WHEN c.tutor_previsto AND c.ore_tutoraggio IS NOT NULL AND c.ore_totali > 0
    THEN ROUND(
      c.ore_tutoraggio::NUMERIC *
      (COALESCE(sess_sum.ore_pianificate, 0)::NUMERIC / c.ore_totali::NUMERIC)
    )
    ELSE 0 END
  ), 0)                                                            AS ore_tutoraggio_pianificate
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
