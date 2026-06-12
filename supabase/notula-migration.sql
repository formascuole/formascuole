-- Notula columns on corsi table
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_numero text;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_stato text NOT NULL DEFAULT 'non_generata'
  CHECK (notula_stato IN ('non_generata', 'bozza', 'inviata', 'accettata', 'rifiutata'));
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_inviata_at timestamptz;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_risposta_at timestamptz;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_motivazione_rifiuto text;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_pdf_url text;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_token text;

-- Create Supabase Storage bucket for notule PDFs (run in Supabase dashboard Storage tab OR via API):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('notule', 'notule', true) ON CONFLICT DO NOTHING;
