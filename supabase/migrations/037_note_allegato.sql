-- Migration 037: allegato nelle note corso
-- Aggiunge colonne per URL e nome del file allegato alle note del corso

ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS note_allegato_url  text,
  ADD COLUMN IF NOT EXISTS note_allegato_nome text;

-- Bucket Supabase Storage per allegati note corso (pubblico per download diretto)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'corso-allegati',
  'corso-allegati',
  true,
  20971520,  -- 20 MB max
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: solo admin/super_admin possono caricare file
CREATE POLICY "admin_upload_corso_allegati"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'corso-allegati'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: solo admin/super_admin possono eliminare file
CREATE POLICY "admin_delete_corso_allegati"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'corso-allegati'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: tutti gli autenticati possono scaricare (formatori inclusi)
CREATE POLICY "authenticated_read_corso_allegati"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'corso-allegati');
