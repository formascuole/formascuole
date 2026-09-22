ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_accettata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_accettata_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accettata_ip text;
