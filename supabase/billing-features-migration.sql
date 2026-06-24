-- Add INPS Gestione Separata to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS inps_gestione_separata BOOLEAN DEFAULT false;

-- Add tariffa oraria fields to finanziamenti
ALTER TABLE finanziamenti ADD COLUMN IF NOT EXISTS tariffa_formatore_ora NUMERIC(10,2);
ALTER TABLE finanziamenti ADD COLUMN IF NOT EXISTS tariffa_tutor_ora NUMERIC(10,2);

-- Precompile DM 219 tariffs (update all rows matching DM 219 naming)
UPDATE finanziamenti
SET tariffa_formatore_ora = 122.00,
    tariffa_tutor_ora = 34.00
WHERE nome ILIKE '%DM 219%'
   OR nome ILIKE '%DM219%'
   OR nome ILIKE '%D.M. 219%'
   OR nome ILIKE '%D.M.219%';
