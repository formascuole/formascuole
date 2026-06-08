-- Regime fiscale formatori
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ha_partita_iva boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regime_fiscale  text    NOT NULL DEFAULT 'notula'
    CONSTRAINT profiles_regime_fiscale_check CHECK (regime_fiscale IN ('forfettario', 'ordinario', 'notula')),
  ADD COLUMN IF NOT EXISTS rivalsa_iva     boolean NOT NULL DEFAULT false;
