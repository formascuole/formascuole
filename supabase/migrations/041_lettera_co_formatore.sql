-- Migration 041: Lettera di incarico per co-formatore
-- Aggiunge campi analoghi a quelli del formatore principale per tracciare
-- la lettera di incarico del co-formatore.

ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS lettera_co_formatore_url              text,
  ADD COLUMN IF NOT EXISTS lettera_co_formatore_firmata          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lettera_co_formatore_firmata_at       timestamptz,
  ADD COLUMN IF NOT EXISTS lettera_co_formatore_ip               text,
  ADD COLUMN IF NOT EXISTS lettera_co_formatore_pending          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lettera_co_formatore_inviata_at       timestamptz,
  ADD COLUMN IF NOT EXISTS lettera_co_formatore_sollecito_at     timestamptz;
