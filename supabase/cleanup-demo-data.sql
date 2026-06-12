-- ============================================================
-- Formascuole — Cleanup demo/test data
-- Keeps only admin and super_admin users.
-- Run in Supabase SQL Editor (service role, bypasses RLS).
-- ============================================================
-- IMPORTANT: After running this script, go to
-- Supabase Dashboard → Authentication → Users
-- and manually delete all auth.users whose email is NOT
-- an admin or super_admin account.
-- ============================================================

-- 1. Questionari
DELETE FROM questionari_risultati;

-- 2. Notule
DELETE FROM notule_corsi;
DELETE FROM notule;

-- 3. Logs, notifications, chat
DELETE FROM sessioni_log;
DELETE FROM solleciti_log;
DELETE FROM notifiche_lette;
DELETE FROM chat_letture;   -- references chat_messaggi, delete first
DELETE FROM chat_messaggi;

-- 4. Candidature
DELETE FROM candidature_corsi;

-- 5. Indisponibilità
DELETE FROM indisponibilita_formatori;

-- 6. Sessioni
DELETE FROM sessioni;

-- 7. Corsi + pivot
DELETE FROM corsi_tags;
DELETE FROM corsi;

-- 8. Referenti progetto (FK to progetti)
DELETE FROM referenti_progetto;

-- 9. Progetti
DELETE FROM progetti;

-- 10. Formatori skills
DELETE FROM formatori_skills;

-- 11. Remove non-admin users
-- (profiles.role is a direct column — there is no profiles_roles table)
DELETE FROM profiles
WHERE role NOT IN ('admin', 'super_admin');

-- ============================================================
-- Verify what remains:
SELECT id, nome, email, role
FROM profiles
ORDER BY role, nome;
-- ============================================================
