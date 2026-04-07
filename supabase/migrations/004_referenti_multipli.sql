-- ============================================================
-- Migration 004: Referenti multipli per progetto
-- Esegui TUTTO in ordine nel Supabase SQL Editor
-- ============================================================

-- ─── 1. Tabella referenti_progetto ───────────────────────────
CREATE TABLE IF NOT EXISTS referenti_progetto (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  progetto_id UUID        NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL CHECK (char_length(trim(nome)) > 0),
  email       TEXT        NOT NULL,
  tel         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Colonna referente_id su corsi ────────────────────────
ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS referente_id UUID
    REFERENCES referenti_progetto(id) ON DELETE SET NULL;

-- ─── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE referenti_progetto ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admins manage referenti" ON referenti_progetto
  FOR ALL USING (is_admin());

-- Formatori / tutori: read referenti of projects where they have a corso
CREATE POLICY "Workers read referenti of own projects" ON referenti_progetto
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.project_id = referenti_progetto.progetto_id
        AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
    )
  );

-- ─── 4. Indici ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_referenti_progetto_progetto
  ON referenti_progetto(progetto_id);

CREATE INDEX IF NOT EXISTS idx_corsi_referente
  ON corsi(referente_id) WHERE referente_id IS NOT NULL;
