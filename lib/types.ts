export type UserRole = 'admin' | 'formatore'
export type ProjectStatus = 'active' | 'pending' | 'completed'
export type CorsoTipo = 'PF' | 'Lab'
export type SollectipoTipo = 'assegnazione' | 'sollecito_1' | 'sollecito_2' | 'sollecito_3'

export interface Profile {
  id: string
  role: UserRole
  nome: string
  email: string
  avatar_initials: string
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
}

export interface Corso {
  id: string
  project_id: string
  title: string
  tipo: CorsoTipo
  ore_totali: number
  formatore_id?: string
  created_at: string
}

export interface CorsoConOre extends Corso {
  ore_pianificate: number
  ore_residue: number
  calendario_completo: boolean
  formatore?: Profile
}

export interface Sessione {
  id: string
  corso_id: string
  data: string
  ore: number
  created_at: string
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
