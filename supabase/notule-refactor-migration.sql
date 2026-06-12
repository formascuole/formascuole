-- Drop old notula columns from corsi
ALTER TABLE corsi DROP COLUMN IF EXISTS notula_numero;
ALTER TABLE corsi DROP COLUMN IF EXISTS notula_stato;
ALTER TABLE corsi DROP COLUMN IF EXISTS notula_inviata_at;
ALTER TABLE corsi DROP COLUMN IF EXISTS notula_risposta_at;
ALTER TABLE corsi DROP COLUMN IF EXISTS notula_motivazione_rifiuto;
ALTER TABLE corsi DROP COLUMN IF EXISTS notula_pdf_url;
ALTER TABLE corsi DROP COLUMN IF EXISTS notula_token;

-- Create notule table
CREATE TABLE IF NOT EXISTS notule (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero text NOT NULL,
  formatore_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  stato text NOT NULL DEFAULT 'bozza'
    CHECK (stato IN ('bozza','inviata','accettata','rifiutata')),
  tipo text NOT NULL DEFAULT 'singola'
    CHECK (tipo IN ('singola','cumulativa')),
  importo_totale numeric(10,2),
  ritenuta numeric(10,2),
  iva numeric(10,2) DEFAULT 0,
  netto numeric(10,2),
  pdf_url text,
  token text,
  inviata_at timestamptz,
  risposta_at timestamptz,
  motivazione_rifiuto text,
  created_at timestamptz DEFAULT now()
);

-- Create pivot table
CREATE TABLE IF NOT EXISTS notule_corsi (
  notula_id uuid REFERENCES notule(id) ON DELETE CASCADE,
  corso_id uuid REFERENCES corsi(id) ON DELETE CASCADE,
  importo numeric(10,2),
  ore_erogate numeric(4,2),
  tariffa_oraria numeric(10,2),
  PRIMARY KEY (notula_id, corso_id)
);

-- Add FK from corsi to notule
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS notula_id uuid REFERENCES notule(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notule_formatore ON notule(formatore_id);
CREATE INDEX IF NOT EXISTS idx_notule_corsi_notula ON notule_corsi(notula_id);
CREATE INDEX IF NOT EXISTS idx_notule_corsi_corso ON notule_corsi(corso_id);

-- RLS
ALTER TABLE notule ENABLE ROW LEVEL SECURITY;
ALTER TABLE notule_corsi ENABLE ROW LEVEL SECURITY;

-- Formatore can see their own notule
CREATE POLICY "formatore_read_own_notule" ON notule FOR SELECT
  USING (formatore_id = auth.uid());
-- Admin reads all
CREATE POLICY "admin_read_notule" ON notule FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- notule_corsi: accessible to formatore (via notula) or admin
CREATE POLICY "formatore_read_own_notule_corsi" ON notule_corsi FOR SELECT
  USING (EXISTS (SELECT 1 FROM notule WHERE id = notula_id AND formatore_id = auth.uid()));
CREATE POLICY "admin_notule_corsi" ON notule_corsi FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));
