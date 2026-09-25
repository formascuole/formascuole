ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS ore_presenza integer,
  ADD COLUMN IF NOT EXISTS ore_online integer;
