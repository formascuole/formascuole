-- Migration 046: parametri e override per monitoraggio DM 219/2025
-- I parametri globali sono fissi nel codice (ucs_formatore=122, ucs_tutor=34,
-- quota_indiretti=0.40, soglia_minima=0.70, quota_min_lab=0.50).
-- Questa tabella memorizza solo gli override per progetto.

CREATE TABLE IF NOT EXISTS dm219_params (
  progetto_id          UUID        PRIMARY KEY REFERENCES progetti(id) ON DELETE CASCADE,
  tutor_riconosciuto   BOOLEAN     NOT NULL DEFAULT true,
  base_quota_lab       TEXT        NOT NULL DEFAULT 'realizzato'
                                   CHECK (base_quota_lab IN ('realizzato', 'accordato')),
  -- Corsi forzati inclusi/esclusi dallo scenario manualmente dall'admin
  corsi_inclusi        UUID[]      NOT NULL DEFAULT '{}',
  corsi_esclusi        UUID[]      NOT NULL DEFAULT '{}',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dm219_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm219_params_admin" ON dm219_params
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
