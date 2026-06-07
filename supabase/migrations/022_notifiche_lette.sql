-- Migration 022: Per-user notification read tracking
-- notifiche_lette stores which solleciti_log entries each admin has read.

CREATE TABLE IF NOT EXISTS notifiche_lette (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notifica_id   uuid NOT NULL REFERENCES solleciti_log(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  letto_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notifica_id, user_id)
);

ALTER TABLE notifiche_lette ENABLE ROW LEVEL SECURITY;

-- Admins can read their own read records
CREATE POLICY "notifiche_lette_select" ON notifiche_lette
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can insert their own read records
CREATE POLICY "notifiche_lette_insert" ON notifiche_lette
  FOR INSERT WITH CHECK (auth.uid() = user_id);
