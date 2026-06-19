ALTER TABLE progetti ADD COLUMN IF NOT EXISTS ref_ruolo text;
ALTER TABLE referenti_progetto ADD COLUMN IF NOT EXISTS ruolo text;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS referente_corso_ruolo text;
