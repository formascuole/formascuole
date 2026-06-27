-- Lettera d'incarico pending/invio/sollecito columns on corsi table
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_incarico_pending boolean DEFAULT false;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_incarico_inviata_at timestamptz;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_incarico_sollecito_at timestamptz;

ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_tutor_pending boolean DEFAULT false;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_tutor_inviata_at timestamptz;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_tutor_sollecito_at timestamptz;
