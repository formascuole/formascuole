-- ============================================================
-- Migration 019: Tariffe orarie su profiles e corsi
-- ============================================================
-- profiles: tariffe predefinite per ruolo (usate come default
--           quando si assegna il formatore/tutor a un corso)
-- corsi: tariffa_oraria_tutor (tariffa specifica del tutor per
--        questo corso, complementare alla tariffa del formatore)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tariffa_oraria_formatore  numeric(10,2),
  ADD COLUMN IF NOT EXISTS tariffa_oraria_tutor      numeric(10,2);

ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS tariffa_oraria_tutor  numeric(10,2);
