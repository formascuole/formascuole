ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS questionario_generato_at  timestamptz,
  ADD COLUMN IF NOT EXISTS questionario_generato_count integer NOT NULL DEFAULT 0;
