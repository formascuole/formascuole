-- ============================================================
-- Migration 008: Catalogo corsi
-- ============================================================
-- 1. Crea tabella catalogo_corsi (template riutilizzabili)
-- 2. Aggiunge descrizione e link_scheda alla tabella corsi
-- Eseguire nel Supabase SQL Editor.
-- ============================================================

-- ─── 1. Tabella catalogo_corsi ───────────────────────────────

CREATE TABLE IF NOT EXISTS catalogo_corsi (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  titolo      TEXT        NOT NULL CHECK (char_length(trim(titolo)) > 0),
  tipo        corso_tipo  NOT NULL,
  descrizione TEXT,
  link_scheda TEXT,
  attivo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE catalogo_corsi ENABLE ROW LEVEL SECURITY;

-- Tutti gli utenti autenticati possono leggere e scrivere il catalogo
-- (la restrizione a super_admin/admin per il DELETE è enforced lato app)
CREATE POLICY "auth_catalogo" ON catalogo_corsi
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── 2. Aggiungi colonne a corsi ─────────────────────────────

ALTER TABLE corsi
  ADD COLUMN IF NOT EXISTS descrizione TEXT,
  ADD COLUMN IF NOT EXISTS link_scheda TEXT;

-- Indice per ricerca per titolo nel catalogo
CREATE INDEX IF NOT EXISTS idx_catalogo_corsi_titolo
  ON catalogo_corsi(titolo);

CREATE INDEX IF NOT EXISTS idx_catalogo_corsi_attivo
  ON catalogo_corsi(attivo) WHERE attivo = true;
