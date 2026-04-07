-- ============================================================
-- Migration 003: Multi-role system, tutor, notes, chat
-- Esegui TUTTO in ordine nel Supabase SQL Editor
-- ============================================================

-- ─── 1. Estendi l'enum user_role ────────────────────────────
-- Postgres permette ADD VALUE senza ricreare l'enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tutor' AFTER 'formatore';

-- ─── 2. Tabella profiles_roles (multi-ruolo) ────────────────
CREATE TABLE IF NOT EXISTS profiles_roles (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       user_role   NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, role)
);

-- Migra i ruoli esistenti nella nuova tabella
INSERT INTO profiles_roles (profile_id, role)
SELECT id, role FROM profiles
ON CONFLICT (profile_id, role) DO NOTHING;

-- ─── 3. Aggiorna get_user_role() per usare profiles_roles ───
-- Restituisce il ruolo "più alto" dell'utente
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles_roles
  WHERE profile_id = auth.uid()
  ORDER BY
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin'       THEN 2
      WHEN 'formatore'   THEN 3
      WHEN 'tutor'       THEN 4
      ELSE 5
    END
  LIMIT 1;
$$;

-- Helper: controlla se l'utente ha UN CERTO ruolo
CREATE OR REPLACE FUNCTION user_has_role(check_role user_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles_roles
    WHERE profile_id = auth.uid() AND role = check_role
  );
$$;

-- Helper: l'utente è admin o super_admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles_roles
    WHERE profile_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- ─── 4. Aggiorna il trigger di signup ───────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role user_role;
  v_nome TEXT;
  v_initials TEXT;
BEGIN
  v_role    := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'formatore');
  v_nome    := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email);
  v_initials := COALESCE(
    NEW.raw_user_meta_data->>'avatar_initials',
    UPPER(LEFT(v_nome, 2))
  );

  INSERT INTO profiles (id, role, nome, email, avatar_initials)
  VALUES (NEW.id, v_role, v_nome, NEW.email, v_initials)
  ON CONFLICT (id) DO NOTHING;

  -- Inserisci anche in profiles_roles
  INSERT INTO profiles_roles (profile_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (profile_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ─── 5. Aggiorna profiles.role a super_admin ─────────────────
-- (esegui dopo aver identificato l'UUID del super_admin)
-- Sostituisci '<UUID>' con l'UUID reale del super_admin
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'admin@formascuole.it';
-- INSERT INTO profiles_roles (profile_id, role)
--   SELECT id, 'super_admin' FROM profiles WHERE email = 'admin@formascuole.it'
--   ON CONFLICT DO NOTHING;

-- ─── 6. tutor_id nella tabella corsi ────────────────────────
ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── 7. Tabella note_corso ───────────────────────────────────
CREATE TABLE IF NOT EXISTS note_corso (
  id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id  UUID        NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  autore_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  testo     TEXT        NOT NULL CHECK (char_length(testo) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. Tabella chat_messaggi ────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messaggi (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  progetto_id UUID        NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
  autore_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  testo       TEXT        NOT NULL CHECK (char_length(testo) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. Tabella chat_letture (read receipts) ─────────────────
CREATE TABLE IF NOT EXISTS chat_letture (
  messaggio_id UUID        NOT NULL REFERENCES chat_messaggi(id) ON DELETE CASCADE,
  utente_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  letto_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (messaggio_id, utente_id)
);

-- ─── 10. RLS per le nuove tabelle ───────────────────────────

ALTER TABLE profiles_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_corso     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messaggi  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_letture   ENABLE ROW LEVEL SECURITY;

-- profiles_roles
CREATE POLICY "Users can read own roles" ON profiles_roles
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Admins can read all roles" ON profiles_roles
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can manage roles" ON profiles_roles
  FOR ALL USING (is_admin());

-- note_corso: admin + formatore assegnato + tutor assegnato
CREATE POLICY "Can read notes if involved in corso" ON note_corso
  FOR SELECT USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.id = note_corso.corso_id
        AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
    )
  );

CREATE POLICY "Can insert notes if involved in corso" ON note_corso
  FOR INSERT WITH CHECK (
    autore_id = auth.uid() AND (
      is_admin() OR
      EXISTS (
        SELECT 1 FROM corsi
        WHERE corsi.id = note_corso.corso_id
          AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
      )
    )
  );

CREATE POLICY "Can delete own notes or admin" ON note_corso
  FOR DELETE USING (autore_id = auth.uid() OR is_admin());

-- chat_messaggi: admin + chi ha corsi nel progetto
CREATE OR REPLACE FUNCTION can_access_chat(p_progetto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT is_admin() OR EXISTS (
    SELECT 1 FROM corsi
    WHERE corsi.project_id = p_progetto_id
      AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
  );
$$;

CREATE POLICY "Chat access for project members" ON chat_messaggi
  FOR SELECT USING (can_access_chat(progetto_id));

CREATE POLICY "Chat insert for project members" ON chat_messaggi
  FOR INSERT WITH CHECK (
    autore_id = auth.uid() AND can_access_chat(progetto_id)
  );

-- chat_letture
CREATE POLICY "Users manage own read receipts" ON chat_letture
  FOR ALL USING (utente_id = auth.uid());

CREATE POLICY "Admins can read all receipts" ON chat_letture
  FOR SELECT USING (is_admin());

-- ─── 11. RLS aggiornate per corsi (aggiunge tutor) ──────────
-- Tutor può leggere i corsi dove è assegnato
DROP POLICY IF EXISTS "Formatori can see own corsi" ON corsi;
CREATE POLICY "Workers can see own corsi" ON corsi
  FOR SELECT USING (
    is_admin() OR
    formatore_id = auth.uid() OR
    tutor_id = auth.uid()
  );

-- ─── 12. Aggiorna RLS profiles per i nuovi ruoli ────────────
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- ─── 13. Indici per performance ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_roles_profile ON profiles_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_messaggi_progetto ON chat_messaggi(progetto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_letture_utente    ON chat_letture(utente_id, messaggio_id);
CREATE INDEX IF NOT EXISTS idx_note_corso_corso       ON note_corso(corso_id, created_at);
CREATE INDEX IF NOT EXISTS idx_corsi_tutor            ON corsi(tutor_id) WHERE tutor_id IS NOT NULL;
