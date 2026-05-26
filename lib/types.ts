export type UserRole = 'super_admin' | 'admin' | 'formatore' | 'tutor'
export type ProjectStatus = 'active' | 'pending' | 'completed'
export type CorsoTipo = 'PF' | 'Lab'
export type ModalitaCorso = 'presenza' | 'online' | 'ibrido'
export type ModalitaSessione = 'presenza' | 'online'
export type SollectipoTipo = 'assegnazione' | 'sollecito_1' | 'sollecito_2' | 'sollecito_3' | 'reminder_sessione' | 'reminder_accettazione'
export type StatoAssegnazione = 'non_assegnato' | 'in_attesa' | 'accettato' | 'rifiutato'

export interface Profile {
  id: string
  role: UserRole          // primary (highest) role — kept for backward compat
  nome: string
  email: string
  avatar_initials: string
  created_at: string
  roles?: UserRole[]      // all assigned roles (from profiles_roles)
}

export interface Finanziamento {
  id: string
  nome: string
  descrizione?: string | null
  attivo: boolean
  created_at: string
}

export interface Progetto {
  id: string
  school_name: string
  address: string
  ref_name: string
  ref_email: string
  ref_tel?: string
  status: ProjectStatus
  anno_scolastico?: string
  finanziamento_id?: string | null
  created_at: string
  created_by?: string
}

export interface ProgettoConStats extends Progetto {
  n_corsi: number
  ore_totali: number
  ore_pianificate: number
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
}

export interface CorsoConOre extends Corso {
  ore_pianificate: number
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
