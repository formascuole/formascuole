-- ============================================================
-- Migration 015: Orari sessioni + referente corso + stato calendario
-- ============================================================
-- Aggiunge:
--   sessioni.ora_inizio / ora_fine       → orari precisi di inizio/fine
--   sessioni.ore → cambia da INTEGER a NUMERIC(4,2) per supportare
--                  mezze ore (es. 2.5h calcolate da orari)
--   sessioni_log: stesse colonne ore aggiornate a NUMERIC
--   corsi.referente_corso_nome/email/telefono
--   corsi.calendario_inviato_at / calendario_confermato / calendario_confermato_at
--   enum sollecito_tipo += 'calendario_inviato_scuola'
--   Ricrea corsi_con_ore per esporre le nuove colonne di corsi
-- ============================================================

-- 1. Aggiungi colonne ora alla tabella sessioni
ALTER TABLE sessioni
  ADD COLUMN IF NOT EXISTS ora_inizio time,
  ADD COLUMN IF NOT EXISTS ora_fine   time;

-- 2. Cambia ore da INTEGER a NUMERIC per supportare frazioni d'ora
ALTER TABLE sessioni
  ALTER COLUMN ore TYPE NUMERIC(4,2) USING ore::NUMERIC(4,2);

-- 3. Aggiorna la stessa colonna in sessioni_log per coerenza
ALTER TABLE sessioni_log
  ALTER COLUMN ore_precedenti TYPE NUMERIC(4,2)
    USING ore_precedenti::NUMERIC(4,2),
  ALTER COLUMN ore_nuove TYPE NUMERIC(4,2)
    USING ore_nuove::NUMERIC(4,2);

-- 4. Aggiungi campi referente corso e stato calendario a corsi
ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS referente_corso_nome      text,
  ADD COLUMN IF NOT EXISTS referente_corso_email     text,
  ADD COLUMN IF NOT EXISTS referente_corso_telefono  text,
  ADD COLUMN IF NOT EXISTS calendario_inviato_at     timestamptz,
  ADD COLUMN IF NOT EXISTS calendario_confermato     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendario_confermato_at  timestamptz;

-- 5. Ricrea corsi_con_ore: PostgreSQL congela le colonne al momento
--    della creazione, quindi è necessario ricreare la view per
--    includere le nuove colonne di corsi.
CREATE OR REPLACE VIEW corsi_con_ore AS
SELECT
  c.*,
  COALESCE(SUM(s.ore), 0)                                  AS ore_pianificate,
  c.ore_totali - COALESCE(SUM(s.ore), 0)                   AS ore_residue,
  CASE WHEN COALESCE(SUM(s.ore), 0) >= c.ore_totali
       THEN true ELSE false END                             AS calendario_completo
FROM corsi c
LEFT JOIN sessioni s ON s.corso_id = c.id
GROUP BY c.id;

-- 6. Estende l'enum sollecito_tipo
ALTER TYPE sollecito_tipo ADD VALUE IF NOT EXISTS 'calendario_inviato_scuola';
