-- ============================================================
-- Migration 017: Campi onboarding formatori
-- ============================================================
-- Aggiunge alla tabella profiles i campi anagrafici, bancari
-- e i flag di stato onboarding.
-- Gli utenti esistenti vengono marcati come già onboardati
-- (password_cambiata=true, profilo_completo=true) per evitare
-- di interrompere l'accesso agli utenti già in uso.
-- I nuovi utenti creati dopo questa migration partiranno con
-- i default (false) e dovranno completare l'onboarding.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS luogo_nascita        text,
  ADD COLUMN IF NOT EXISTS data_nascita         date,
  ADD COLUMN IF NOT EXISTS codice_fiscale       text,
  ADD COLUMN IF NOT EXISTS indirizzo_via        text,
  ADD COLUMN IF NOT EXISTS indirizzo_cap        text,
  ADD COLUMN IF NOT EXISTS indirizzo_citta      text,
  ADD COLUMN IF NOT EXISTS indirizzo_provincia  text,
  ADD COLUMN IF NOT EXISTS iban                 text,
  ADD COLUMN IF NOT EXISTS banca                text,
  ADD COLUMN IF NOT EXISTS intestatario_conto   text,
  ADD COLUMN IF NOT EXISTS profilo_completo     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_cambiata    boolean NOT NULL DEFAULT false;

-- Gli utenti esistenti saltano l'onboarding
UPDATE profiles
SET password_cambiata = true, profilo_completo = true
WHERE password_cambiata = false;
