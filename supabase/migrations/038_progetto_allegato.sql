-- Migration 038: allegato a livello di progetto
-- Documento della scuola visibile a tutti i formatori del progetto

ALTER TABLE progetti
  ADD COLUMN IF NOT EXISTS allegato_url  text,
  ADD COLUMN IF NOT EXISTS allegato_nome text;

-- Bucket condiviso con corso-allegati già creato in 037.
-- Usiamo lo stesso bucket 'corso-allegati', path: progetti/{id}/...
-- Le policy esistenti coprono già questo caso (admin upload/delete, autenticati read).
