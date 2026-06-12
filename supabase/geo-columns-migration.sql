-- Add geographic columns to progetti
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS regione text;
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS provincia text;   -- 2-letter code
ALTER TABLE progetti ADD COLUMN IF NOT EXISTS citta text;
-- NOTE: existing 'address' column becomes via e civico only

-- Add regione to profiles (formatori/tutori)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS regione text;
