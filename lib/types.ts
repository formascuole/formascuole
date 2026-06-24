export type UserRole = 'super_admin' | 'admin' | 'formatore' | 'tutor'
export type FasciaIndisponibilita = 'mattina' | 'pomeriggio' | 'tutto_il_giorno'
export type ProjectStatus = 'active' | 'pending' | 'completed'
export type CorsoTipo = 'PF' | 'Lab'
export type ModalitaCorso = 'presenza' | 'online' | 'ibrido' | 'residenziale' | 'semi_residenziale'
export type ModalitaSessione = 'presenza' | 'online'
export type SollectipoTipo = 'assegnazione' | 'sollecito_1' | 'sollecito_2' | 'sollecito_3' | 'reminder_sessione' | 'reminder_accettazione' | 'reminder_questionario' | 'reminder_candidatura' | 'notifica_calendario_completo' | 'notifica_corso_concluso' | 'calendario_inviato_scuola'
export type StatoAssegnazione = 'non_assegnato' | 'in_attesa' | 'accettato' | 'rifiutato'
export type StatoCandidatura = 'in_attesa' | 'selezionato' | 'non_selezionato'

export interface Profile {
  id: string
  role: UserRole          // primary (highest) role — kept for backward compat
  nome: string
  email: string
  avatar_initials: string
  created_at: string
  roles?: UserRole[]      // all assigned roles (from profiles_roles)
  // Onboarding / fiscal fields
  luogo_nascita?: string | null
  data_nascita?: string | null
  codice_fiscale?: string | null
  indirizzo_via?: string | null
  indirizzo_cap?: string | null
  indirizzo_citta?: string | null
  indirizzo_provincia?: string | null
  iban?: string | null
  banca?: string | null
  intestatario_conto?: string | null
  profilo_completo?: boolean | null
  password_cambiata?: boolean | null
  tariffa_oraria_formatore?: number | null
  tariffa_oraria_tutor?: number | null
  ha_partita_iva?: boolean
  regime_fiscale?: 'forfettario' | 'ordinario' | 'notula'
  rivalsa_iva?: boolean
  partita_iva?: string | null
  telefono?: string | null
  regione?: string | null
}

export interface Finanziamento {
  id: string
  nome: string
  descrizione?: string | null
  attivo: boolean
  created_at: string
}

export interface Tag {
  id: string
  nome: string
  colore: string
  created_at: string
}

export interface Progetto {
  id: string
  school_name: string
  address: string
  ref_name: string
  ref_email: string
  ref_tel?: string
  ref_ruolo?: string | null
  status: ProjectStatus
  anno_scolastico?: string
  finanziamento_id?: string | null
  created_at: string
  created_by?: string
  // Geographic columns (new)
  regione?: string | null
  provincia?: string | null  // 2-letter code
  citta?: string | null
  // 'address' remains for backward compatibility but now means via e civico
}

export interface ProgettoConStats extends Progetto {
  n_corsi: number
  ore_totali: number
  ore_pianificate: number
  ore_erogate: number
  percentuale_completamento: number
  corsi_senza_formatore: number
  corsi_senza_calendario: number
  ore_tutoraggio_totali: number
  ore_tutoraggio_pianificate: number
  unread_chat?: number
}

export interface Referente {
  id: string
  progetto_id: string
  nome: string
  email: string
  tel?: string
  ruolo?: string | null
  created_at: string
}

export interface CatalogoCorso {
  id: string
  titolo: string
  tipo: CorsoTipo
  descrizione?: string | null
  link_scheda?: string | null
  attivo: boolean
  created_at: string
}

export interface Corso {
  id: string
  project_id: string
  title: string
  tipo: CorsoTipo
  ore_totali: number
  formatore_id?: string
  tutor_id?: string
  referente_id?: string
  modalita?: ModalitaCorso
  tutor_previsto: boolean
  tutor_nome?: string
  ore_tutoraggio?: number
  created_at: string
  stato_assegnazione?: StatoAssegnazione
  accettazione_richiesta_at?: string | null
  accettazione_risposta_at?: string | null
  rifiuto_motivazione?: string | null
  descrizione?: string | null
  link_scheda?: string | null
  candidature_aperte?: boolean
  candidature_aperte_at?: string | null
  referente_corso_nome?: string | null
  referente_corso_email?: string | null
  referente_corso_telefono?: string | null
  referente_corso_ruolo?: string | null
  calendario_inviato_at?: string | null
  calendario_confermato?: boolean
  calendario_confermato_at?: string | null
  corso_completato?: boolean
  corso_completato_at?: string | null
  tariffa_oraria?: number | null
  tariffa_oraria_tutor?: number | null
  questionario_generato_at?: string | null
  questionario_generato_count?: number
  // Notula FK
  notula_id?: string | null
  // Fattura P.IVA
  fattura_ricevuta?: boolean
  fattura_ricevuta_at?: string | null
  // Edizione, note, location
  edizione?: string | null
  note?: string | null
  location?: string | null
  // Notification system
  notificato?: boolean
  token_assegnazione?: string | null
  pre_assegnazione?: boolean
}

export interface Candidatura {
  id: string
  corso_id: string
  formatore_id: string
  note: string | null
  stato: StatoCandidatura
  created_at: string
  formatore?: Pick<Profile, 'id' | 'nome' | 'email' | 'avatar_initials'> | null
}

export interface CorsoConOre extends Corso {
  ore_pianificate: number
  ore_erogate: number
  ore_residue: number
  calendario_completo: boolean
  formatore?: Profile
  tutor?: Profile
  referente?: Referente
}

export interface Sessione {
  id: string
  corso_id: string
  data: string
  ore: number
  ora_inizio?: string | null
  ora_fine?: string | null
  modalita_sessione?: ModalitaSessione
  completata: boolean
  completata_at?: string | null
  created_at: string
}

export interface NotaCorso {
  id: string
  corso_id: string
  autore_id: string
  testo: string
  created_at: string
  autore?: Profile
}

export interface ChatMessaggio {
  id: string
  progetto_id: string
  autore_id: string
  testo: string
  created_at: string
  autore?: Profile
  letto?: boolean
}

export interface SollecitoLog {
  id: string
  corso_id: string
  formatore_id: string
  tipo: SollectipoTipo
  sent_at: string
  corso?: CorsoConOre
  formatore?: Profile
}

export interface Indisponibilita {
  id: string
  formatore_id: string
  data: string
  fascia: FasciaIndisponibilita
  note?: string | null
  created_at: string
  formatore?: Pick<Profile, 'id' | 'nome'> | null
}

export interface Notula {
  id: string
  numero: string
  formatore_id: string
  stato: 'bozza' | 'inviata' | 'accettata' | 'rifiutata'
  tipo: 'singola' | 'cumulativa'
  importo_totale: number | null
  ritenuta: number | null
  iva: number
  netto: number | null
  pdf_url: string | null
  token: string | null
  inviata_at: string | null
  risposta_at: string | null
  motivazione_rifiuto: string | null
  created_at: string
  // joined
  corsi?: NotuleCorso[]
}

export interface NotuleCorso {
  notula_id: string
  corso_id: string
  importo: number | null
  ore_erogate: number | null
  tariffa_oraria: number | null
  // joined
  corso?: Pick<Corso, 'id' | 'title' | 'project_id'> & { school_name?: string }
}

export interface QuestionarioRisultato {
  id: string
  corso_id: string | null
  scuola: string | null
  titolo_corso: string | null
  tipo_corso: string | null
  formatore: string | null
  regione: string | null
  provincia: string | null
  linea_finanziamento: string | null
  data_somministrazione: string | null
  media_formatore: number | null
  media_contenuti: number | null
  media_apprendimento: number | null
  impatto_applicare: string | null
  testo_strumenti: string | null
  testo_suggerimenti: string | null
  riassunto_ai: string | null
  numero_risposte: number
  created_at: string
}
