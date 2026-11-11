-- ============================================================
-- Audit log: traccia INSERT / UPDATE / DELETE su tabelle chiave
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  tabella       text        NOT NULL,          -- 'corsi' | 'sessioni' | 'progetti' | …
  record_id     uuid        NOT NULL,          -- id del record modificato
  operazione    text        NOT NULL,          -- 'INSERT' | 'UPDATE' | 'DELETE'
  utente_id     uuid,                          -- auth.uid() al momento della modifica (NULL se da service role)
  old_data      jsonb,                         -- valori prima della modifica (NULL per INSERT)
  new_data      jsonb                          -- valori dopo la modifica  (NULL per DELETE)
);

-- Indici per le query più comuni
CREATE INDEX IF NOT EXISTS audit_log_tabella_record ON audit_log (tabella, record_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at     ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_utente_id      ON audit_log (utente_id);

-- RLS: solo service role scrive, gli admin leggono
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_read_admin" ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Nessun INSERT/UPDATE/DELETE via RLS: solo il trigger (SECURITY DEFINER) scrive
CREATE POLICY "audit_log_no_direct_write" ON audit_log
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── Funzione trigger generica ────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER   -- gira come owner, bypassa RLS sulla tabella audit_log
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
  v_old       jsonb;
  v_new       jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old       := NULL;
    v_new       := to_jsonb(NEW);
  ELSE -- UPDATE
    v_record_id := NEW.id;
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (tabella, record_id, operazione, utente_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    auth.uid(),   -- NULL quando chiamato da service role / trigger interni
    v_old,
    v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Trigger su corsi ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_corsi ON corsi;
CREATE TRIGGER trg_audit_corsi
  AFTER INSERT OR UPDATE OR DELETE ON corsi
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── Trigger su sessioni ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_sessioni ON sessioni;
CREATE TRIGGER trg_audit_sessioni
  AFTER INSERT OR UPDATE OR DELETE ON sessioni
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── Trigger su progetti ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_progetti ON progetti;
CREATE TRIGGER trg_audit_progetti
  AFTER INSERT OR UPDATE OR DELETE ON progetti
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
