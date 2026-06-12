-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL UNIQUE,
  colore text NOT NULL DEFAULT '#378ADD',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Corso ↔ tag pivot
CREATE TABLE IF NOT EXISTS corsi_tags (
  corso_id uuid NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (corso_id, tag_id)
);

-- Formatore ↔ skill (uses same tags table)
CREATE TABLE IF NOT EXISTS formatori_skills (
  formatore_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id       uuid NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (formatore_id, tag_id)
);

-- RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE corsi_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE formatori_skills ENABLE ROW LEVEL SECURITY;

-- tags: authenticated users can read, admins can write
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

-- corsi_tags: same
CREATE POLICY "corsi_tags_select" ON corsi_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "corsi_tags_insert" ON corsi_tags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);
CREATE POLICY "corsi_tags_delete" ON corsi_tags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

-- formatori_skills: same
CREATE POLICY "formatori_skills_select" ON formatori_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "formatori_skills_insert" ON formatori_skills FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);
CREATE POLICY "formatori_skills_delete" ON formatori_skills FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

-- Default tags
INSERT INTO tags (nome, colore) VALUES
  ('Sicurezza sul Lavoro', '#EF4444'),
  ('Digitale', '#3B82F6'),
  ('STEM', '#8B5CF6'),
  ('Lingue', '#10B981'),
  ('Management', '#F59E0B'),
  ('Inclusione', '#EC4899'),
  ('Sostenibilità', '#22C55E'),
  ('Coding', '#6366F1'),
  ('Robotica', '#0EA5E9'),
  ('Arte e Creatività', '#F97316'),
  ('Matematica', '#14B8A6'),
  ('Scienze', '#84CC16'),
  ('Storia e Cultura', '#A78BFA'),
  ('Cittadinanza Digitale', '#38BDF8'),
  ('AI e Machine Learning', '#7C3AED')
ON CONFLICT (nome) DO NOTHING;
