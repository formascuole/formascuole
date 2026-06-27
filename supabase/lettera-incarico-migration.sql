-- Lettera d'incarico columns on corsi table
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_incarico_url text;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_incarico_firmata boolean DEFAULT false;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_incarico_firmata_at timestamptz;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_incarico_ip text;

ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_tutor_url text;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_tutor_firmata boolean DEFAULT false;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_tutor_firmata_at timestamptz;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS lettera_tutor_ip text;
