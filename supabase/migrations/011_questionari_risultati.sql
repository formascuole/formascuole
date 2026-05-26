-- ============================================================
-- Migration 011: Tabella questionari_risultati
-- ============================================================
-- Raccoglie i risultati aggregati dei questionari di valutazione
-- inviati da Make.com dopo ogni compilazione del form.
-- Eseguire nel Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS questionari_risultati (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id              UUID          REFERENCES corsi(id) ON DELETE SET NULL,
  scuola                TEXT,
  titolo_corso          TEXT,
  tipo_corso            TEXT,
  formatore             TEXT,
  regione               TEXT,
  provincia             TEXT,
  linea_finanziamento   TEXT,
  data_somministrazione TEXT,
  media_formatore       NUMERIC(3,2),
  media_contenuti       NUMERIC(3,2),
  media_apprendimento   NUMERIC(3,2),
  impatto_applicare     TEXT,
  testo_strumenti       TEXT,
  testo_suggerimenti    TEXT,
  riassunto_ai          TEXT,
  numero_risposte       INTEGER       NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE questionari_risultati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_questionari" ON questionari_risultati
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_questionari_corso_id
  ON questionari_risultati(corso_id);
