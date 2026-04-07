-- ============================================
-- Formascuole - Seed data
-- Run AFTER creating users in Supabase Auth dashboard
-- ============================================
--
-- Create these users first in Supabase Auth:
--   admin@formascuola.it  (password: Admin123!)  → role: admin
--   mario.rossi@formascuola.it (password: Formatore1!) → role: formatore
--   lucia.bianchi@formascuola.it (password: Formatore2!) → role: formatore
--
-- The trigger will auto-create profiles.
-- Then run this SQL to update profiles and insert demo data.

-- Update profiles (run after creating auth users)
-- Replace UUIDs with actual user IDs from auth.users
/*
UPDATE profiles SET role='admin', nome='Admin Formascuole', avatar_initials='AF'
  WHERE email='admin@formascuole.it';

UPDATE profiles SET nome='Mario Rossi', avatar_initials='MR'
  WHERE email='m.rossi@formascuole.it';

UPDATE profiles SET nome='Lucia Bianchi', avatar_initials='LB'
  WHERE email='l.bianchi@formascuole.it';
*/

-- ============================================
-- Demo data (use after updating profiles above)
-- ============================================

-- Insert projects
INSERT INTO progetti (id, school_name, address, ref_name, ref_email, ref_tel, status, anno_scolastico)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   'ITIS G. Marconi',
   'Via Roma 15, Milano',
   'Prof. Giuseppe Verdi',
   'g.verdi@itisMarconi.edu.it',
   '02-12345678',
   'active',
   '2024-2025'),
  ('22222222-2222-2222-2222-222222222222',
   'Liceo Scientifico A. Einstein',
   'Corso Italia 42, Torino',
   'Prof.ssa Anna Ferrari',
   'a.ferrari@liceoEinstein.edu.it',
   '011-9876543',
   'active',
   '2024-2025'),
  ('33333333-3333-3333-3333-333333333333',
   'IIS L. Da Vinci',
   'Via Garibaldi 7, Roma',
   'Prof. Marco Conti',
   'm.conti@iisDaVinci.edu.it',
   '06-5544332',
   'pending',
   '2024-2025');

-- Insert corsi for project 1 (ITIS Marconi)
-- These use placeholder formatore UUIDs — replace with real ones
INSERT INTO corsi (id, project_id, title, tipo, ore_totali)
VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sicurezza sul Lavoro D.Lgs 81/08', 'PF', 20),
  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Laboratorio Robotica Industriale', 'Lab', 15),
  ('aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Digitalizzazione PMI', 'PF', 12);

-- Insert corsi for project 2 (Liceo Einstein)
INSERT INTO corsi (id, project_id, title, tipo, ore_totali)
VALUES
  ('bbbb0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Orientamento STEM e Università', 'PF', 8),
  ('bbbb0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Laboratorio Coding e IA', 'Lab', 10);

-- Insert corsi for project 3 (IIS Da Vinci)
INSERT INTO corsi (id, project_id, title, tipo, ore_totali)
VALUES
  ('cccc0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Imprenditorialità Giovanile', 'PF', 16),
  ('cccc0002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Laboratorio Comunicazione Digitale', 'Lab', 12);

-- Insert some sessions for corso aaaa0001 (to show progress)
INSERT INTO sessioni (corso_id, data, ore)
VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '2025-02-10', 4),
  ('aaaa0001-0000-0000-0000-000000000001', '2025-02-17', 4),
  ('aaaa0001-0000-0000-0000-000000000001', '2025-02-24', 4);

-- Insert sessions for corso bbbb0001 (complete)
INSERT INTO sessioni (corso_id, data, ore)
VALUES
  ('bbbb0001-0000-0000-0000-000000000001', '2025-01-15', 4),
  ('bbbb0001-0000-0000-0000-000000000001', '2025-01-22', 4);

-- NOTE: To assign formatori to corsi, run:
-- UPDATE corsi SET formatore_id = '<mario_rossi_uuid>' WHERE id = 'aaaa0001-0000-0000-0000-000000000001';
-- UPDATE corsi SET formatore_id = '<mario_rossi_uuid>' WHERE id = 'bbbb0001-0000-0000-0000-000000000001';
-- UPDATE corsi SET formatore_id = '<lucia_bianchi_uuid>' WHERE id = 'aaaa0002-0000-0000-0000-000000000002';
-- UPDATE corsi SET formatore_id = '<lucia_bianchi_uuid>' WHERE id = 'bbbb0002-0000-0000-0000-000000000002';
