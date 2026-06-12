ALTER TABLE corsi ADD COLUMN IF NOT EXISTS fattura_ricevuta boolean DEFAULT false;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS fattura_ricevuta_at timestamptz;
