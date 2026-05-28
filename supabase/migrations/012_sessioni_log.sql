CREATE TABLE IF NOT EXISTS sessioni_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessione_id uuid REFERENCES sessioni(id) ON DELETE CASCADE,
  corso_id uuid REFERENCES corsi(id),
  utente_id uuid REFERENCES profiles(id),
  tipo_modifica text CHECK (tipo_modifica IN (
    'creazione', 'modifica_data', 'modifica_ore', 'eliminazione'
  )),
  data_precedente date,
  data_nuova date,
  ore_precedenti integer,
  ore_nuove integer,
  motivazione_categoria text CHECK (motivazione_categoria IN (
    'richiesta_scuola',
    'impegno_formatore',
    'causa_forza_maggiore',
    'problemi_tecnici_logistici',
    'accordo_reciproco',
    'altro'
  )),
  motivazione_dettaglio text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sessioni_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_sessioni_log" ON sessioni_log
  FOR ALL USING (auth.role() = 'authenticated');
