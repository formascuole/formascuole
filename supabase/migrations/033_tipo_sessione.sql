ALTER TABLE sessioni ADD COLUMN IF NOT EXISTS tipo_sessione text
  CHECK (tipo_sessione IN ('presenza', 'online', 'residenziale', 'scuola'));
