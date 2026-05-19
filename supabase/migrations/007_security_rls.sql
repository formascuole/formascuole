-- ============================================================
-- Migration 007: Sicurezza — RLS su tutte le tabelle
-- ============================================================
-- Supabase Security Advisor ha segnalato tabelle senza RLS.
-- Questo script:
--   1. Crea la tabella `finanziamenti` se non esiste (mancante da tutte le migration precedenti)
--   2. Abilita RLS su tutte e 7 le tabelle segnalate (idempotente)
--   3. Ricrea le policy in modo idempotente (DROP IF EXISTS + CREATE)
--
-- Eseguire nel Supabase SQL Editor.
-- ============================================================

-- ─── 1. Crea finanziamenti se non esiste ─────────────────────

CREATE TABLE IF NOT EXISTS finanziamenti (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT        NOT NULL CHECK (char_length(trim(nome)) > 0),
  descrizione TEXT,
  attivo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Abilita RLS (idempotente — sicuro da rieseguire) ─────

ALTER TABLE finanziamenti      ENABLE ROW LEVEL SECURITY;
ALTER TABLE referenti_progetto ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messaggi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_letture       ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_corso         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE solleciti_log      ENABLE ROW LEVEL SECURITY;

-- ─── 3. Policy per finanziamenti ─────────────────────────────
-- Tutti gli utenti autenticati possono leggere (dati di riferimento).
-- Solo admin possono creare/modificare/eliminare.

DROP POLICY IF EXISTS "Authenticated users can read finanziamenti" ON finanziamenti;
DROP POLICY IF EXISTS "Admins can manage finanziamenti"            ON finanziamenti;

CREATE POLICY "Authenticated users can read finanziamenti" ON finanziamenti
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage finanziamenti" ON finanziamenti
  FOR ALL USING (is_admin());

-- ─── 4. Policy per referenti_progetto ────────────────────────

DROP POLICY IF EXISTS "Admins manage referenti"                    ON referenti_progetto;
DROP POLICY IF EXISTS "Workers read referenti of own projects"     ON referenti_progetto;

CREATE POLICY "Admins manage referenti" ON referenti_progetto
  FOR ALL USING (is_admin());

CREATE POLICY "Workers read referenti of own projects" ON referenti_progetto
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.project_id = referenti_progetto.progetto_id
        AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
    )
  );

-- ─── 5. Policy per chat_messaggi ─────────────────────────────

DROP POLICY IF EXISTS "Chat access for project members"  ON chat_messaggi;
DROP POLICY IF EXISTS "Chat insert for project members"  ON chat_messaggi;

CREATE POLICY "Chat access for project members" ON chat_messaggi
  FOR SELECT USING (can_access_chat(progetto_id));

CREATE POLICY "Chat insert for project members" ON chat_messaggi
  FOR INSERT WITH CHECK (
    autore_id = auth.uid() AND can_access_chat(progetto_id)
  );

-- ─── 6. Policy per chat_letture ──────────────────────────────

DROP POLICY IF EXISTS "Users manage own read receipts" ON chat_letture;
DROP POLICY IF EXISTS "Admins can read all receipts"   ON chat_letture;

CREATE POLICY "Users manage own read receipts" ON chat_letture
  FOR ALL USING (utente_id = auth.uid());

CREATE POLICY "Admins can read all receipts" ON chat_letture
  FOR SELECT USING (is_admin());

-- ─── 7. Policy per note_corso ────────────────────────────────

DROP POLICY IF EXISTS "Can read notes if involved in corso"   ON note_corso;
DROP POLICY IF EXISTS "Can insert notes if involved in corso" ON note_corso;
DROP POLICY IF EXISTS "Can delete own notes or admin"         ON note_corso;

CREATE POLICY "Can read notes if involved in corso" ON note_corso
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.id = note_corso.corso_id
        AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
    )
  );

CREATE POLICY "Can insert notes if involved in corso" ON note_corso
  FOR INSERT WITH CHECK (
    autore_id = auth.uid() AND (
      is_admin() OR EXISTS (
        SELECT 1 FROM corsi
        WHERE corsi.id = note_corso.corso_id
          AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
      )
    )
  );

CREATE POLICY "Can delete own notes or admin" ON note_corso
  FOR DELETE USING (autore_id = auth.uid() OR is_admin());

-- ─── 8. Policy per profiles_roles ────────────────────────────

DROP POLICY IF EXISTS "Users can read own roles"   ON profiles_roles;
DROP POLICY IF EXISTS "Admins can read all roles"  ON profiles_roles;
DROP POLICY IF EXISTS "Admins can manage roles"    ON profiles_roles;

CREATE POLICY "Users can read own roles" ON profiles_roles
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Admins can read all roles" ON profiles_roles
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can manage roles" ON profiles_roles
  FOR ALL USING (is_admin());

-- ─── 9. Policy per solleciti_log ─────────────────────────────

DROP POLICY IF EXISTS "Admins can do everything on solleciti_log" ON solleciti_log;
DROP POLICY IF EXISTS "Formatori can see own solleciti"           ON solleciti_log;

CREATE POLICY "Admins can do everything on solleciti_log" ON solleciti_log
  FOR ALL USING (is_admin());

-- Formatori e tutor possono vedere i propri solleciti
CREATE POLICY "Formatori can see own solleciti" ON solleciti_log
  FOR SELECT USING (
    (get_user_role() IN ('formatore', 'tutor')) AND formatore_id = auth.uid()
  );

-- ─── Verifica finale ─────────────────────────────────────────
-- Esegui questa query dopo per confermare che tutte le tabelle
-- abbiano RLS abilitato:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Tutte le righe devono avere rowsecurity = true.
