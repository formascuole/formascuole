-- 005: Sistema accettazione corso
-- Eseguire su Supabase SQL Editor

CREATE TYPE stato_assegnazione AS ENUM (
  'non_assegnato',
  'in_attesa',
  'accettato',
  'rifiutato'
);

ALTER TABLE corsi
  ADD COLUMN stato_assegnazione      stato_assegnazione NOT NULL DEFAULT 'non_assegnato',
  ADD COLUMN accettazione_richiesta_at TIMESTAMPTZ,
  ADD COLUMN accettazione_risposta_at  TIMESTAMPTZ,
  ADD COLUMN rifiuto_motivazione       TEXT;

-- Corsi già assegnati prima del sistema → considerati accettati
UPDATE corsi SET stato_assegnazione = 'accettato' WHERE formatore_id IS NOT NULL;

-- Indice per le query del cron
CREATE INDEX idx_corsi_stato_accettazione
  ON corsi(stato_assegnazione, accettazione_richiesta_at)
  WHERE stato_assegnazione = 'in_attesa';
