-- Tabella indisponibilità formatori
CREATE TABLE IF NOT EXISTS indisponibilita_formatori (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  formatore_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data date NOT NULL,
  fascia text NOT NULL CHECK (fascia IN ('mattina', 'pomeriggio', 'tutto_il_giorno')),
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE indisponibilita_formatori ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_indisponibilita"
  ON indisponibilita_formatori
  FOR ALL
  USING (auth.role() = 'authenticated');
