-- ============================================================
-- Comunicazioni: log degli invii email massivi
-- ============================================================

CREATE TABLE IF NOT EXISTS comunicazioni_log (
  id            bigserial    PRIMARY KEY,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  inviata_da    uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  tipologia     text         NOT NULL,  -- 'tutti' | 'admin' | 'progetto' | 'ore_non_firmate'
  progetto_id   uuid         REFERENCES progetti(id) ON DELETE SET NULL,
  oggetto       text         NOT NULL,
  corpo         text         NOT NULL,
  destinatari   jsonb        NOT NULL DEFAULT '[]',  -- array di {email, nome}
  n_inviati     int          NOT NULL DEFAULT 0,
  n_errori      int          NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS comunicazioni_log_created_at ON comunicazioni_log (created_at DESC);
CREATE INDEX IF NOT EXISTS comunicazioni_log_inviata_da ON comunicazioni_log (inviata_da);

ALTER TABLE comunicazioni_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunicazioni_log_read_admin" ON comunicazioni_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "comunicazioni_log_insert_admin" ON comunicazioni_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );
