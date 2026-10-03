-- Portale materiali corso: token, scadenza, link video, materiali, accessi, elaborati

-- Columns on existing tables
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS token_materiali text UNIQUE;
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS materiali_scadenza date;
ALTER TABLE sessioni ADD COLUMN IF NOT EXISTS link_videoconferenza text;

-- Materiali caricati da formatore/admin
CREATE TABLE IF NOT EXISTS materiali_corso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id uuid NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  caricato_da uuid REFERENCES profiles(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descrizione text,
  tipo text NOT NULL CHECK (tipo IN ('file', 'link')),
  url text NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Registro accessi al portale
CREATE TABLE IF NOT EXISTS accessi_materiali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id uuid NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cognome text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Elaborati caricati dai partecipanti
CREATE TABLE IF NOT EXISTS elaborati_partecipanti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corso_id uuid NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  partecipante_nome text NOT NULL,
  partecipante_cognome text NOT NULL,
  partecipante_email text NOT NULL,
  nome_file text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: materiali_corso
ALTER TABLE materiali_corso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read materiali" ON materiali_corso;
DROP POLICY IF EXISTS "Auth insert materiali" ON materiali_corso;
DROP POLICY IF EXISTS "Auth delete materiali" ON materiali_corso;
CREATE POLICY "Public read materiali" ON materiali_corso FOR SELECT USING (true);
CREATE POLICY "Auth insert materiali" ON materiali_corso FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete materiali" ON materiali_corso FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS: accessi_materiali
ALTER TABLE accessi_materiali ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert accessi" ON accessi_materiali;
DROP POLICY IF EXISTS "Public read accessi" ON accessi_materiali;
CREATE POLICY "Public insert accessi" ON accessi_materiali FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read accessi" ON accessi_materiali FOR SELECT USING (true);

-- RLS: elaborati_partecipanti
ALTER TABLE elaborati_partecipanti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert elaborati" ON elaborati_partecipanti;
DROP POLICY IF EXISTS "Public read elaborati" ON elaborati_partecipanti;
CREATE POLICY "Public insert elaborati" ON elaborati_partecipanti FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read elaborati" ON elaborati_partecipanti FOR SELECT USING (true);

-- Storage buckets (run in Supabase SQL Editor — may need dashboard if policy creation fails)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('materiali-corso', 'materiali-corso', true, 52428800)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('elaborati-partecipanti', 'elaborati-partecipanti', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: materiali-corso (public bucket)
DROP POLICY IF EXISTS "Public read materiali-corso" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload materiali-corso" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete materiali-corso" ON storage.objects;
CREATE POLICY "Public read materiali-corso" ON storage.objects FOR SELECT USING (bucket_id = 'materiali-corso');
CREATE POLICY "Auth upload materiali-corso" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materiali-corso' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete materiali-corso" ON storage.objects FOR DELETE USING (bucket_id = 'materiali-corso' AND auth.uid() IS NOT NULL);

-- Storage policies: elaborati-partecipanti (private bucket, anon can upload via service role)
DROP POLICY IF EXISTS "Service upload elaborati" ON storage.objects;
DROP POLICY IF EXISTS "Auth read elaborati" ON storage.objects;
CREATE POLICY "Service upload elaborati" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'elaborati-partecipanti');
CREATE POLICY "Auth read elaborati" ON storage.objects FOR SELECT USING (bucket_id = 'elaborati-partecipanti' AND auth.uid() IS NOT NULL);
