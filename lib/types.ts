export type UserRole = 'super_admin' | 'admin' | 'formatore' | 'tutor'
export type ProjectStatus = 'active' | 'pending' | 'completed'
export type CorsoTipo = 'PF' | 'Lab'
export type ModalitaCorso = 'presenza' | 'online' | 'ibrido'
export type ModalitaSessione = 'presenza' | 'online'
export type SollectipoTipo = 'assegnazione' | 'sollecito_1' | 'sollecito_2' | 'sollecito_3'

export interface Profile {
  id: string
  role: UserRole          // primary (highest) role — kept for backward compat
  nome: string
  email: string
  avatar_initials: string
  created_at: string
  roles?: UserRole[]      // all assigned roles (from profiles_roles)
}

export interface Progetto {
  id: string
  school_name: string
  address: string
  ref_name: string
  ref_email: string
  ref_tel?: string
  status: ProjectStatus
  anno_scolastico: string
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

export interface Corso {
  id: string
  project_id: string
  title: string
  tipo: CorsoTipo
  ore_totali: number
  formatore_id?: string
  tutor_id?: string
  modalita?: ModalitaCorso
  tutor_previsto: boolean
  tutor_nome?: string
  ore_tutoraggio?: number
  created_at: string
}

export interface CorsoConOre extends Corso {
  ore_pianificate: number
  ore_residue: number
  calendario_completo: boolean
  formatore?: Profile
  tutor?: Profile
}

export interface Sessione {
  id: string
  corso_id: string
  data: string
  ore: number
  modalita_sessione?: ModalitaSessione
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
