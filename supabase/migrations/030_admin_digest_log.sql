-- Tabella per accumulare eventi da inviare nel digest giornaliero agli admin (21:00)
CREATE TABLE IF NOT EXISTS admin_digest_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  -- 'sessione_modificata' | 'accettazione_corso' | 'nessuna_risposta' | 'corso_da_concludere'
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  inviato boolean DEFAULT false,
  inviato_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_digest_log_pending
  ON admin_digest_log (inviato, created_at)
  WHERE inviato = false;

-- RLS: solo admin/super_admin possono leggere; il service role bypassa RLS
ALTER TABLE admin_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_digest_log_select_admin" ON admin_digest_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
