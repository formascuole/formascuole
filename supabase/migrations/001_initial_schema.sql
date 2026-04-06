-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'formatore');
CREATE TYPE project_status AS ENUM ('active', 'pending', 'completed');
CREATE TYPE corso_tipo AS ENUM ('PF', 'Lab');
CREATE TYPE sollecito_tipo AS ENUM ('assegnazione', 'sollecito_1', 'sollecito_2', 'sollecito_3');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'formatore',
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_initials TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Progetti table
CREATE TABLE progetti (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name TEXT NOT NULL,
  address TEXT NOT NULL,
  ref_name TEXT NOT NULL,
  ref_email TEXT NOT NULL,
  ref_tel TEXT,
  status project_status NOT NULL DEFAULT 'pending',
  anno_scolastico TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Corsi table
CREATE TABLE corsi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tipo corso_tipo NOT NULL,
  ore_totali INTEGER NOT NULL CHECK (ore_totali > 0),
  formatore_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessioni table
CREATE TABLE sessioni (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id UUID NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  ore INTEGER NOT NULL CHECK (ore > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solleciti log table
CREATE TABLE solleciti_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id UUID NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  formatore_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo sollecito_tipo NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE progetti ENABLE ROW LEVEL SECURITY;
ALTER TABLE corsi ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE solleciti_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- PROFILES policies
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (get_user_role() = 'admin');

-- PROGETTI policies
CREATE POLICY "Admins can do everything on progetti" ON progetti
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Formatori can see progetti of their corsi" ON progetti
  FOR SELECT USING (
    get_user_role() = 'formatore' AND
    EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.project_id = progetti.id
        AND corsi.formatore_id = auth.uid()
    )
  );

-- CORSI policies
CREATE POLICY "Admins can do everything on corsi" ON corsi
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Formatori can see own corsi" ON corsi
  FOR SELECT USING (
    get_user_role() = 'formatore' AND formatore_id = auth.uid()
  );

-- SESSIONI policies
CREATE POLICY "Admins can do everything on sessioni" ON sessioni
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Formatori can manage sessioni of own corsi" ON sessioni
  FOR ALL USING (
    get_user_role() = 'formatore' AND
    EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.id = sessioni.corso_id
        AND corsi.formatore_id = auth.uid()
    )
  );

-- SOLLECITI_LOG policies
CREATE POLICY "Admins can do everything on solleciti_log" ON solleciti_log
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Formatori can see own solleciti" ON solleciti_log
  FOR SELECT USING (
    get_user_role() = 'formatore' AND formatore_id = auth.uid()
  );

-- =============================================
-- USEFUL VIEWS
-- =============================================

-- View: corsi with computed ore fields
CREATE OR REPLACE VIEW corsi_con_ore AS
SELECT
  c.*,
  COALESCE(SUM(s.ore), 0) AS ore_pianificate,
  c.ore_totali - COALESCE(SUM(s.ore), 0) AS ore_residue,
  CASE WHEN COALESCE(SUM(s.ore), 0) >= c.ore_totali THEN true ELSE false END AS calendario_completo
FROM corsi c
LEFT JOIN sessioni s ON s.corso_id = c.id
GROUP BY c.id;

-- View: progetti with summary stats
CREATE OR REPLACE VIEW progetti_con_stats AS
SELECT
  p.*,
  COUNT(DISTINCT c.id) AS n_corsi,
  COALESCE(SUM(c.ore_totali), 0) AS ore_totali,
  COALESCE(SUM(sess_sum.ore_pianificate), 0) AS ore_pianificate,
  CASE
    WHEN COALESCE(SUM(c.ore_totali), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(sess_sum.ore_pianificate), 0)::NUMERIC /
       SUM(c.ore_totali)::NUMERIC) * 100, 1
    )
  END AS percentuale_completamento,
  COUNT(DISTINCT CASE WHEN c.formatore_id IS NULL THEN c.id END) AS corsi_senza_formatore,
  COUNT(DISTINCT CASE WHEN co.calendario_completo = false AND c.formatore_id IS NOT NULL THEN c.id END) AS corsi_senza_calendario
FROM progetti p
LEFT JOIN corsi c ON c.project_id = p.id
LEFT JOIN LATERAL (
  SELECT corso_id, COALESCE(SUM(ore), 0) AS ore_pianificate
  FROM sessioni
  WHERE corso_id = c.id
  GROUP BY corso_id
) sess_sum ON true
LEFT JOIN corsi_con_ore co ON co.id = c.id
GROUP BY p.id;

-- =============================================
-- TRIGGER: auto-create profile on signup
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, role, nome, email, avatar_initials)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'formatore'),
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_initials', UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), 2)))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
