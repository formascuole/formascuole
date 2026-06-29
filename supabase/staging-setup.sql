-- ============================================================
-- Formascuole — Schema completo per staging / nuovo ambiente
-- Eseguire UNA SOLA VOLTA su un database Supabase vuoto.
-- Consolida tutte le migration (001-023) + tutti i file SQL
-- aggiuntivi nella cartella supabase/ nella versione finale.
-- ============================================================
--
-- PRIMA DI ESEGUIRE: creare manualmente nel Supabase dashboard
-- la bucket Storage "notule" (pubblica):
--   Storage → New bucket → nome: notule → Public: ON
--   (usata per PDF notule, lettere d'incarico)
--
-- ============================================================


-- ============================================================
-- 1. ESTENSIONI
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 2. ENUM TYPES (versione finale, tutti i valori)
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'formatore',
  'tutor'
);

CREATE TYPE project_status AS ENUM (
  'active',
  'pending',
  'completed'
);

CREATE TYPE corso_tipo AS ENUM (
  'PF',
  'Lab'
);

-- Tutti i valori usati nel cron e nelle notifiche
CREATE TYPE sollecito_tipo AS ENUM (
  'assegnazione',
  'sollecito_1',
  'sollecito_2',
  'sollecito_3',
  'reminder_sessione',
  'reminder_accettazione',
  'reminder_questionario',
  'reminder_candidatura',
  'notifica_calendario_completo',
  'notifica_corso_concluso',
  'calendario_inviato_scuola'
);

CREATE TYPE modalita_corso AS ENUM (
  'presenza',
  'online',
  'ibrido',
  'residenziale',
  'semi_residenziale'
);

CREATE TYPE modalita_sessione_tipo AS ENUM (
  'presenza',
  'online'
);

CREATE TYPE stato_assegnazione AS ENUM (
  'non_assegnato',
  'in_attesa',
  'accettato',
  'rifiutato'
);


-- ============================================================
-- 3. TABELLE (ordine FK-safe)
-- ============================================================

-- ── 3.1 finanziamenti ────────────────────────────────────────
CREATE TABLE finanziamenti (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                 TEXT          NOT NULL CHECK (char_length(trim(nome)) > 0),
  descrizione          TEXT,
  attivo               BOOLEAN       NOT NULL DEFAULT true,
  tariffa_formatore_ora NUMERIC(10,2),
  tariffa_tutor_ora    NUMERIC(10,2),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 3.2 profiles ─────────────────────────────────────────────
-- Estende auth.users di Supabase.
-- "role" mantiene il ruolo principale per backward-compatibility;
-- il multi-ruolo è gestito tramite profiles_roles.
CREATE TABLE profiles (
  id                      UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                    user_role    NOT NULL DEFAULT 'formatore',
  nome                    TEXT         NOT NULL,
  email                   TEXT         NOT NULL,
  avatar_initials         TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Dati anagrafici onboarding
  luogo_nascita           TEXT,
  data_nascita            DATE,
  codice_fiscale          TEXT,
  indirizzo_via           TEXT,
  indirizzo_cap           TEXT,
  indirizzo_citta         TEXT,
  indirizzo_provincia     TEXT,
  iban                    TEXT,
  banca                   TEXT,
  intestatario_conto      TEXT,
  profilo_completo        BOOLEAN      NOT NULL DEFAULT false,
  password_cambiata       BOOLEAN      NOT NULL DEFAULT false,
  -- Tariffe
  tariffa_oraria_formatore NUMERIC(10,2),
  tariffa_oraria_tutor     NUMERIC(10,2),
  -- Regime fiscale
  ha_partita_iva          BOOLEAN      NOT NULL DEFAULT false,
  partita_iva             TEXT,
  regime_fiscale          TEXT         NOT NULL DEFAULT 'notula'
    CONSTRAINT profiles_regime_fiscale_check
    CHECK (regime_fiscale IN ('forfettario', 'ordinario', 'notula')),
  rivalsa_iva             BOOLEAN      NOT NULL DEFAULT false,
  inps_gestione_separata  BOOLEAN               DEFAULT false,
  -- Contatti e localizzazione
  telefono                TEXT,
  regione                 TEXT
);

-- ── 3.3 profiles_roles ───────────────────────────────────────
-- Tabella multi-ruolo: un utente può avere più ruoli.
CREATE TABLE profiles_roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        user_role   NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, role)
);

-- ── 3.4 tags ─────────────────────────────────────────────────
CREATE TABLE tags (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT        NOT NULL UNIQUE,
  colore     TEXT        NOT NULL DEFAULT '#378ADD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3.5 catalogo_corsi ───────────────────────────────────────
CREATE TABLE catalogo_corsi (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  titolo      TEXT        NOT NULL CHECK (char_length(trim(titolo)) > 0),
  tipo        corso_tipo  NOT NULL,
  descrizione TEXT,
  link_scheda TEXT,
  attivo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3.6 notule ───────────────────────────────────────────────
-- Deve precedere corsi perché corsi.notula_id la referenzia.
CREATE TABLE notule (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero               TEXT        NOT NULL,
  formatore_id         UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  stato                TEXT        NOT NULL DEFAULT 'bozza'
    CHECK (stato IN ('bozza', 'inviata', 'accettata', 'rifiutata')),
  tipo                 TEXT        NOT NULL DEFAULT 'singola'
    CHECK (tipo IN ('singola', 'cumulativa')),
  importo_totale       NUMERIC(10,2),
  ritenuta             NUMERIC(10,2),
  iva                  NUMERIC(10,2) DEFAULT 0,
  netto                NUMERIC(10,2),
  pdf_url              TEXT,
  token                TEXT,
  inviata_at           TIMESTAMPTZ,
  risposta_at          TIMESTAMPTZ,
  motivazione_rifiuto  TEXT,
  created_at           TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 3.7 progetti ─────────────────────────────────────────────
CREATE TABLE progetti (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name      TEXT           NOT NULL,
  address          TEXT           NOT NULL,
  ref_name         TEXT           NOT NULL,
  ref_email        TEXT           NOT NULL,
  ref_tel          TEXT,
  ref_ruolo        TEXT,
  status           project_status NOT NULL DEFAULT 'pending',
  anno_scolastico  TEXT,                         -- nullable (migration 009)
  finanziamento_id UUID           REFERENCES finanziamenti(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by       UUID           REFERENCES profiles(id) ON DELETE SET NULL,
  -- Colonne geografiche
  regione          TEXT,
  provincia        TEXT,                         -- codice 2 lettere
  citta            TEXT
);

-- ── 3.8 referenti_progetto ───────────────────────────────────
CREATE TABLE referenti_progetto (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  progetto_id UUID        NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL CHECK (char_length(trim(nome)) > 0),
  email       TEXT        NOT NULL,
  tel         TEXT,
  ruolo       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3.9 corsi ────────────────────────────────────────────────
CREATE TABLE corsi (
  id                          UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id                  UUID               NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
  title                       TEXT               NOT NULL,
  tipo                        corso_tipo         NOT NULL,
  ore_totali                  INTEGER            NOT NULL CHECK (ore_totali > 0),
  formatore_id                UUID               REFERENCES profiles(id) ON DELETE SET NULL,
  tutor_id                    UUID               REFERENCES profiles(id) ON DELETE SET NULL,
  referente_id                UUID               REFERENCES referenti_progetto(id) ON DELETE SET NULL,
  notula_id                   UUID               REFERENCES notule(id) ON DELETE SET NULL,
  -- Modalità e tutoraggio
  modalita                    modalita_corso,
  tutor_previsto              BOOLEAN            NOT NULL DEFAULT false,
  tutor_nome                  TEXT,
  ore_tutoraggio              INTEGER,
  -- Stato assegnazione
  stato_assegnazione          stato_assegnazione NOT NULL DEFAULT 'non_assegnato',
  accettazione_richiesta_at   TIMESTAMPTZ,
  accettazione_risposta_at    TIMESTAMPTZ,
  rifiuto_motivazione         TEXT,
  -- Catalogo / scheda
  descrizione                 TEXT,
  link_scheda                 TEXT,
  -- Referente corso (contatto interno)
  referente_corso_nome        TEXT,
  referente_corso_email       TEXT,
  referente_corso_telefono    TEXT,
  referente_corso_ruolo       TEXT,
  -- Calendario
  calendario_inviato_at       TIMESTAMPTZ,
  calendario_confermato       BOOLEAN            DEFAULT false,
  calendario_confermato_at    TIMESTAMPTZ,
  calendario_token            TEXT,
  -- Completamento corso
  corso_completato            BOOLEAN            NOT NULL DEFAULT false,
  corso_completato_at         TIMESTAMPTZ,
  -- Tariffe
  tariffa_oraria              NUMERIC(10,2),
  tariffa_oraria_tutor        NUMERIC(10,2),
  -- Questionario
  questionario_generato_at    TIMESTAMPTZ,
  questionario_generato_count INTEGER            NOT NULL DEFAULT 0,
  -- Fattura
  fattura_ricevuta            BOOLEAN            DEFAULT false,
  fattura_ricevuta_at         TIMESTAMPTZ,
  -- Metadati aggiuntivi
  edizione                    TEXT,
  note                        TEXT,
  location                    TEXT,
  -- Sistema notifiche e assegnazione via token
  notificato                  BOOLEAN            DEFAULT false,
  token_assegnazione          TEXT,
  pre_assegnazione            BOOLEAN            DEFAULT false,
  -- Candidature
  candidature_aperte          BOOLEAN            DEFAULT false,
  candidature_aperte_at       TIMESTAMPTZ,
  -- Lettere d'incarico — formatore
  lettera_incarico_url        TEXT,
  lettera_incarico_firmata    BOOLEAN            DEFAULT false,
  lettera_incarico_firmata_at TIMESTAMPTZ,
  lettera_incarico_ip         TEXT,
  lettera_incarico_pending    BOOLEAN            DEFAULT false,
  lettera_incarico_inviata_at TIMESTAMPTZ,
  lettera_incarico_sollecito_at TIMESTAMPTZ,
  -- Lettere d'incarico — tutor
  lettera_tutor_url           TEXT,
  lettera_tutor_firmata       BOOLEAN            DEFAULT false,
  lettera_tutor_firmata_at    TIMESTAMPTZ,
  lettera_tutor_ip            TEXT,
  lettera_tutor_pending       BOOLEAN            DEFAULT false,
  lettera_tutor_inviata_at    TIMESTAMPTZ,
  lettera_tutor_sollecito_at  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ── 3.10 notule_corsi ────────────────────────────────────────
CREATE TABLE notule_corsi (
  notula_id    UUID          REFERENCES notule(id) ON DELETE CASCADE,
  corso_id     UUID          REFERENCES corsi(id)  ON DELETE CASCADE,
  importo      NUMERIC(10,2),
  ore_erogate  NUMERIC(4,2),
  tariffa_oraria NUMERIC(10,2),
  PRIMARY KEY (notula_id, corso_id)
);

-- ── 3.11 sessioni ────────────────────────────────────────────
CREATE TABLE sessioni (
  id                  UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id            UUID                   NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  data                DATE                   NOT NULL,
  ore                 NUMERIC(4,2)           NOT NULL CHECK (ore > 0),
  ora_inizio          TIME,
  ora_fine            TIME,
  modalita_sessione   modalita_sessione_tipo,
  completata          BOOLEAN                NOT NULL DEFAULT false,
  completata_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

-- ── 3.12 sessioni_log ────────────────────────────────────────
CREATE TABLE sessioni_log (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessione_id           UUID        REFERENCES sessioni(id) ON DELETE CASCADE,
  corso_id              UUID        REFERENCES corsi(id),
  utente_id             UUID        REFERENCES profiles(id),
  tipo_modifica         TEXT        CHECK (tipo_modifica IN (
                                      'creazione', 'modifica_data',
                                      'modifica_ore', 'eliminazione'
                                    )),
  data_precedente       DATE,
  data_nuova            DATE,
  ore_precedenti        NUMERIC(4,2),
  ore_nuove             NUMERIC(4,2),
  motivazione_categoria TEXT        CHECK (motivazione_categoria IN (
                                      'richiesta_scuola',
                                      'impegno_formatore',
                                      'causa_forza_maggiore',
                                      'problemi_tecnici_logistici',
                                      'accordo_reciproco',
                                      'altro'
                                    )),
  motivazione_dettaglio TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3.13 solleciti_log ───────────────────────────────────────
CREATE TABLE solleciti_log (
  id           UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id     UUID            NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  formatore_id UUID            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo         sollecito_tipo  NOT NULL,
  sent_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── 3.14 note_corso ──────────────────────────────────────────
CREATE TABLE note_corso (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id   UUID        NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  autore_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  testo      TEXT        NOT NULL CHECK (char_length(testo) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3.15 chat_messaggi ───────────────────────────────────────
CREATE TABLE chat_messaggi (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  progetto_id UUID        NOT NULL REFERENCES progetti(id) ON DELETE CASCADE,
  autore_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  testo       TEXT        NOT NULL CHECK (char_length(testo) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3.16 chat_letture ────────────────────────────────────────
CREATE TABLE chat_letture (
  messaggio_id UUID        NOT NULL REFERENCES chat_messaggi(id) ON DELETE CASCADE,
  utente_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  letto_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (messaggio_id, utente_id)
);

-- ── 3.17 questionari_risultati ───────────────────────────────
CREATE TABLE questionari_risultati (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id              UUID        REFERENCES corsi(id) ON DELETE SET NULL,
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
  numero_risposte       INTEGER     NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3.18 indisponibilita_formatori ───────────────────────────
CREATE TABLE indisponibilita_formatori (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  formatore_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data         DATE        NOT NULL,
  fascia       TEXT        NOT NULL CHECK (fascia IN ('mattina', 'pomeriggio', 'tutto_il_giorno')),
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3.19 notifiche_lette ─────────────────────────────────────
-- Traccia quali notifiche (solleciti_log) ogni admin ha letto.
CREATE TABLE notifiche_lette (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notifica_id UUID        NOT NULL REFERENCES solleciti_log(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  letto_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notifica_id, user_id)
);

-- ── 3.20 corsi_tags ──────────────────────────────────────────
CREATE TABLE corsi_tags (
  corso_id UUID NOT NULL REFERENCES corsi(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (corso_id, tag_id)
);

-- ── 3.21 formatori_skills ────────────────────────────────────
CREATE TABLE formatori_skills (
  formatore_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id       UUID NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (formatore_id, tag_id)
);

-- ── 3.22 candidature_corsi ───────────────────────────────────
CREATE TABLE candidature_corsi (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  corso_id     UUID        NOT NULL REFERENCES corsi(id)    ON DELETE CASCADE,
  formatore_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note         TEXT,
  stato        TEXT        NOT NULL DEFAULT 'in_attesa'
    CHECK (stato IN ('in_attesa', 'selezionato', 'non_selezionato')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (corso_id, formatore_id)
);


-- ============================================================
-- 4. FUNZIONI HELPER (usate nelle policy RLS e nei trigger)
-- ============================================================

-- Restituisce il ruolo più alto dell'utente corrente
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

-- Controlla se l'utente possiede un ruolo specifico
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

-- Scorciatoia: l'utente è admin o super_admin?
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

-- Verifica se l'utente può accedere alla chat di un progetto
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


-- ============================================================
-- 5. VIEW (versione finale con tutte le colonne)
-- ============================================================

-- corsi_con_ore: ore pianificate, erogate, residue, flag completamento
CREATE VIEW corsi_con_ore AS
SELECT
  c.*,
  COALESCE(SUM(s.ore), 0)                                                       AS ore_pianificate,
  COALESCE(SUM(CASE WHEN s.completata = true THEN s.ore ELSE 0 END), 0)         AS ore_erogate,
  c.ore_totali - COALESCE(SUM(s.ore), 0)                                        AS ore_residue,
  CASE WHEN COALESCE(SUM(s.ore), 0) >= c.ore_totali
       THEN true ELSE false END                                                  AS calendario_completo
FROM corsi c
LEFT JOIN sessioni s ON s.corso_id = c.id
GROUP BY c.id;

-- progetti_con_stats: statistiche aggregate per progetto
CREATE VIEW progetti_con_stats AS
SELECT
  p.*,
  COUNT(DISTINCT c.id)                                                           AS n_corsi,
  COALESCE(SUM(c.ore_totali), 0)                                                AS ore_totali,
  COALESCE(SUM(sess_sum.ore_pianificate), 0)                                    AS ore_pianificate,
  COALESCE(SUM(sess_sum.ore_erogate), 0)                                        AS ore_erogate,
  CASE
    WHEN COALESCE(SUM(c.ore_totali), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(sess_sum.ore_pianificate), 0)::NUMERIC /
       SUM(c.ore_totali)::NUMERIC) * 100, 1
    )
  END                                                                            AS percentuale_completamento,
  COUNT(DISTINCT CASE WHEN c.formatore_id IS NULL THEN c.id END)                AS corsi_senza_formatore,
  COUNT(DISTINCT CASE WHEN co.calendario_completo = false
                       AND c.formatore_id IS NOT NULL THEN c.id END)            AS corsi_senza_calendario,
  COALESCE(SUM(CASE WHEN c.tutor_previsto THEN c.ore_tutoraggio ELSE 0 END), 0) AS ore_tutoraggio_totali,
  COALESCE(SUM(
    CASE WHEN c.tutor_previsto AND c.ore_tutoraggio IS NOT NULL AND c.ore_totali > 0
    THEN ROUND(
      c.ore_tutoraggio::NUMERIC *
      (COALESCE(sess_sum.ore_pianificate, 0)::NUMERIC / c.ore_totali::NUMERIC)
    )
    ELSE 0 END
  ), 0)                                                                          AS ore_tutoraggio_pianificate
FROM progetti p
LEFT JOIN corsi c ON c.project_id = p.id
LEFT JOIN LATERAL (
  SELECT
    corso_id,
    COALESCE(SUM(ore), 0)                                                        AS ore_pianificate,
    COALESCE(SUM(CASE WHEN completata = true THEN ore ELSE 0 END), 0)            AS ore_erogate
  FROM sessioni
  WHERE corso_id = c.id
  GROUP BY corso_id
) sess_sum ON true
LEFT JOIN corsi_con_ore co ON co.id = c.id
GROUP BY p.id;


-- ============================================================
-- 6. ROW LEVEL SECURITY — abilita su tutte le tabelle
-- ============================================================

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanziamenti          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_corsi         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notule                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE notule_corsi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE progetti               ENABLE ROW LEVEL SECURITY;
ALTER TABLE referenti_progetto     ENABLE ROW LEVEL SECURITY;
ALTER TABLE corsi                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessioni               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessioni_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE solleciti_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_corso             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messaggi          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_letture           ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionari_risultati  ENABLE ROW LEVEL SECURITY;
ALTER TABLE indisponibilita_formatori ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifiche_lette        ENABLE ROW LEVEL SECURITY;
ALTER TABLE corsi_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE formatori_skills       ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidature_corsi      ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 7. POLICY RLS
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ── profiles_roles ───────────────────────────────────────────
CREATE POLICY "profiles_roles_select_own" ON profiles_roles
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "profiles_roles_select_admin" ON profiles_roles
  FOR SELECT USING (is_admin());

CREATE POLICY "profiles_roles_manage_admin" ON profiles_roles
  FOR ALL USING (is_admin());

-- ── finanziamenti ────────────────────────────────────────────
CREATE POLICY "finanziamenti_select_auth" ON finanziamenti
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "finanziamenti_manage_admin" ON finanziamenti
  FOR ALL USING (is_admin());

-- ── tags ─────────────────────────────────────────────────────
CREATE POLICY "tags_select" ON tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tags_insert" ON tags
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "tags_update" ON tags
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "tags_delete" ON tags
  FOR DELETE TO authenticated USING (is_admin());

-- ── catalogo_corsi ───────────────────────────────────────────
CREATE POLICY "catalogo_auth" ON catalogo_corsi
  FOR ALL USING (auth.role() = 'authenticated');

-- ── notule ───────────────────────────────────────────────────
CREATE POLICY "notule_select_own" ON notule
  FOR SELECT USING (formatore_id = auth.uid());

CREATE POLICY "notule_manage_admin" ON notule
  FOR ALL USING (is_admin());

-- ── notule_corsi ─────────────────────────────────────────────
CREATE POLICY "notule_corsi_select_own" ON notule_corsi
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM notule WHERE id = notula_id AND formatore_id = auth.uid())
  );

CREATE POLICY "notule_corsi_manage_admin" ON notule_corsi
  FOR ALL USING (is_admin());

-- ── progetti ─────────────────────────────────────────────────
CREATE POLICY "progetti_manage_admin" ON progetti
  FOR ALL USING (is_admin());

CREATE POLICY "progetti_select_workers" ON progetti
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.project_id = progetti.id
        AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
    )
  );

-- ── referenti_progetto ───────────────────────────────────────
CREATE POLICY "referenti_manage_admin" ON referenti_progetto
  FOR ALL USING (is_admin());

CREATE POLICY "referenti_select_workers" ON referenti_progetto
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.project_id = referenti_progetto.progetto_id
        AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
    )
  );

-- ── corsi ────────────────────────────────────────────────────
CREATE POLICY "corsi_manage_admin" ON corsi
  FOR ALL USING (is_admin());

CREATE POLICY "corsi_select_workers" ON corsi
  FOR SELECT USING (
    is_admin() OR
    formatore_id = auth.uid() OR
    tutor_id = auth.uid()
  );

-- ── sessioni ─────────────────────────────────────────────────
CREATE POLICY "sessioni_manage_admin" ON sessioni
  FOR ALL USING (is_admin());

CREATE POLICY "sessioni_manage_formatore" ON sessioni
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.id = sessioni.corso_id
        AND corsi.formatore_id = auth.uid()
    )
  );

-- ── sessioni_log ─────────────────────────────────────────────
CREATE POLICY "sessioni_log_auth" ON sessioni_log
  FOR ALL USING (auth.role() = 'authenticated');

-- ── solleciti_log ────────────────────────────────────────────
CREATE POLICY "solleciti_log_manage_admin" ON solleciti_log
  FOR ALL USING (is_admin());

CREATE POLICY "solleciti_log_select_workers" ON solleciti_log
  FOR SELECT USING (
    get_user_role() IN ('formatore', 'tutor') AND formatore_id = auth.uid()
  );

-- ── note_corso ───────────────────────────────────────────────
CREATE POLICY "note_select_involved" ON note_corso
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM corsi
      WHERE corsi.id = note_corso.corso_id
        AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
    )
  );

CREATE POLICY "note_insert_involved" ON note_corso
  FOR INSERT WITH CHECK (
    autore_id = auth.uid() AND (
      is_admin() OR EXISTS (
        SELECT 1 FROM corsi
        WHERE corsi.id = note_corso.corso_id
          AND (corsi.formatore_id = auth.uid() OR corsi.tutor_id = auth.uid())
      )
    )
  );

CREATE POLICY "note_delete_own_or_admin" ON note_corso
  FOR DELETE USING (autore_id = auth.uid() OR is_admin());

-- ── chat_messaggi ────────────────────────────────────────────
CREATE POLICY "chat_select_members" ON chat_messaggi
  FOR SELECT USING (can_access_chat(progetto_id));

CREATE POLICY "chat_insert_members" ON chat_messaggi
  FOR INSERT WITH CHECK (
    autore_id = auth.uid() AND can_access_chat(progetto_id)
  );

-- ── chat_letture ─────────────────────────────────────────────
CREATE POLICY "chat_letture_own" ON chat_letture
  FOR ALL USING (utente_id = auth.uid());

CREATE POLICY "chat_letture_admin" ON chat_letture
  FOR SELECT USING (is_admin());

-- ── questionari_risultati ────────────────────────────────────
CREATE POLICY "questionari_auth" ON questionari_risultati
  FOR ALL USING (auth.role() = 'authenticated');

-- ── indisponibilita_formatori ────────────────────────────────
CREATE POLICY "indisponibilita_auth" ON indisponibilita_formatori
  FOR ALL USING (auth.role() = 'authenticated');

-- ── notifiche_lette ──────────────────────────────────────────
CREATE POLICY "notifiche_lette_select" ON notifiche_lette
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifiche_lette_insert" ON notifiche_lette
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── corsi_tags ───────────────────────────────────────────────
CREATE POLICY "corsi_tags_select" ON corsi_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "corsi_tags_insert" ON corsi_tags
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "corsi_tags_delete" ON corsi_tags
  FOR DELETE TO authenticated USING (is_admin());

-- ── formatori_skills ─────────────────────────────────────────
CREATE POLICY "formatori_skills_select" ON formatori_skills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "formatori_skills_insert" ON formatori_skills
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "formatori_skills_delete" ON formatori_skills
  FOR DELETE TO authenticated USING (is_admin());

-- ── candidature_corsi ────────────────────────────────────────
CREATE POLICY "candidature_select_auth" ON candidature_corsi
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "candidature_insert_formatore" ON candidature_corsi
  FOR INSERT WITH CHECK (formatore_id = auth.uid());

CREATE POLICY "candidature_update_admin" ON candidature_corsi
  FOR UPDATE USING (is_admin());

CREATE POLICY "candidature_delete_admin" ON candidature_corsi
  FOR DELETE USING (is_admin());


-- ============================================================
-- 8. INDICI (performance)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_roles_profile
  ON profiles_roles(profile_id);

CREATE INDEX IF NOT EXISTS idx_corsi_project
  ON corsi(project_id);

CREATE INDEX IF NOT EXISTS idx_corsi_formatore
  ON corsi(formatore_id) WHERE formatore_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_corsi_tutor
  ON corsi(tutor_id) WHERE tutor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_corsi_stato_accettazione
  ON corsi(stato_assegnazione, accettazione_richiesta_at)
  WHERE stato_assegnazione = 'in_attesa';

CREATE INDEX IF NOT EXISTS idx_corsi_lettera_pending
  ON corsi(lettera_incarico_pending)
  WHERE lettera_incarico_pending = true;

CREATE INDEX IF NOT EXISTS idx_corsi_lettera_tutor_pending
  ON corsi(lettera_tutor_pending)
  WHERE lettera_tutor_pending = true;

CREATE INDEX IF NOT EXISTS idx_sessioni_corso
  ON sessioni(corso_id, data);

CREATE INDEX IF NOT EXISTS idx_sessioni_data
  ON sessioni(data);

CREATE INDEX IF NOT EXISTS idx_sessioni_completata
  ON sessioni(corso_id, completata);

CREATE INDEX IF NOT EXISTS idx_solleciti_log_corso
  ON solleciti_log(corso_id, tipo);

CREATE INDEX IF NOT EXISTS idx_solleciti_log_formatore
  ON solleciti_log(formatore_id);

CREATE INDEX IF NOT EXISTS idx_chat_messaggi_progetto
  ON chat_messaggi(progetto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_letture_utente
  ON chat_letture(utente_id, messaggio_id);

CREATE INDEX IF NOT EXISTS idx_note_corso_corso
  ON note_corso(corso_id, created_at);

CREATE INDEX IF NOT EXISTS idx_referenti_progetto_progetto
  ON referenti_progetto(progetto_id);

CREATE INDEX IF NOT EXISTS idx_corsi_referente
  ON corsi(referente_id) WHERE referente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questionari_corso
  ON questionari_risultati(corso_id);

CREATE INDEX IF NOT EXISTS idx_notule_formatore
  ON notule(formatore_id);

CREATE INDEX IF NOT EXISTS idx_notule_corsi_notula
  ON notule_corsi(notula_id);

CREATE INDEX IF NOT EXISTS idx_notule_corsi_corso
  ON notule_corsi(corso_id);

CREATE INDEX IF NOT EXISTS idx_catalogo_corsi_titolo
  ON catalogo_corsi(titolo);

CREATE INDEX IF NOT EXISTS idx_catalogo_corsi_attivo
  ON catalogo_corsi(attivo) WHERE attivo = true;

CREATE INDEX IF NOT EXISTS idx_candidature_corso
  ON candidature_corsi(corso_id);

CREATE INDEX IF NOT EXISTS idx_candidature_formatore
  ON candidature_corsi(formatore_id);

CREATE INDEX IF NOT EXISTS idx_indisponibilita_formatore
  ON indisponibilita_formatori(formatore_id, data);


-- ============================================================
-- 9. TRIGGER — auto-crea profile al signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role     user_role;
  v_nome     TEXT;
  v_initials TEXT;
BEGIN
  v_role     := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'formatore');
  v_nome     := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email);
  v_initials := COALESCE(
    NEW.raw_user_meta_data->>'avatar_initials',
    UPPER(LEFT(v_nome, 2))
  );

  INSERT INTO profiles (id, role, nome, email, avatar_initials)
  VALUES (NEW.id, v_role, v_nome, NEW.email, v_initials)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles_roles (profile_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (profile_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 10. DATI DI CONFIGURAZIONE BASE — 15 tag predefiniti
-- ============================================================

INSERT INTO tags (nome, colore) VALUES
  ('Sicurezza sul Lavoro',     '#EF4444'),
  ('Digitale',                 '#3B82F6'),
  ('STEM',                     '#8B5CF6'),
  ('Lingue',                   '#10B981'),
  ('Management',               '#F59E0B'),
  ('Inclusione',               '#EC4899'),
  ('Sostenibilità',            '#22C55E'),
  ('Coding',                   '#6366F1'),
  ('Robotica',                 '#0EA5E9'),
  ('Arte e Creatività',        '#F97316'),
  ('Matematica',               '#14B8A6'),
  ('Scienze',                  '#84CC16'),
  ('Storia e Cultura',         '#A78BFA'),
  ('Cittadinanza Digitale',    '#38BDF8'),
  ('AI e Machine Learning',    '#7C3AED')
ON CONFLICT (nome) DO NOTHING;


-- ============================================================
-- 11. STORAGE BUCKET — creare manualmente nel dashboard
-- ============================================================
--
-- Supabase non permette la creazione di bucket tramite SQL
-- standard nell'editor; farlo dalla UI:
--
--   Storage → "New bucket"
--   ┌─────────────────────────────────────────────┐
--   │ Nome:   notule                              │
--   │ Public: ON (accesso pubblico ai PDF)        │
--   └─────────────────────────────────────────────┘
--
-- Struttura percorsi utilizzata:
--   notule/{formatore_id}/{numero_notula}.pdf      ← PDF notule
--   lettere/{corso_id}/lettera_formatore.pdf       ← Lettere formatori
--   lettere/{corso_id}/lettera_tutor.pdf           ← Lettere tutor
--
-- In alternativa, via Supabase Management API o SQL service role:
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('notule', 'notule', true)
--   ON CONFLICT (id) DO NOTHING;
--
-- ============================================================
