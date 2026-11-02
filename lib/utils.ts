import { ProjectStatus, CorsoTipo } from './types'

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    active: 'Attivo',
    pending: 'In attesa',
    completed: 'Completato',
    cancelled: 'Annullato',
  }
  return labels[status]
}

export function getStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  return colors[status]
}

export function getTipoLabel(tipo: CorsoTipo): string {
  if (tipo === 'PF') return 'Percorso Formativo'
  if (tipo === 'Lab') return 'Laboratorio'
  if (tipo === 'PF+Lab') return 'PF e Laboratorio'
  return tipo
}

export function getTipoColor(tipo: CorsoTipo): string {
  if (tipo === 'PF') return 'bg-purple-100 text-purple-700'
  if (tipo === 'PF+Lab') return 'bg-indigo-100 text-indigo-700'
  return 'bg-orange-100 text-orange-700'
}

/** True se il corso ha natura di Percorso Formativo */
export function isTipoPF(tipo: string | null | undefined): boolean {
  return tipo === 'PF' || tipo === 'PF+Lab'
}

/** True se il corso ha natura di Laboratorio */
export function isTipoLab(tipo: string | null | undefined): boolean {
  return tipo === 'Lab' || tipo === 'PF+Lab'
}

export function calcPercentuale(pianificate: number, totali: number): number {
  if (totali === 0) return 0
  return Math.min(Math.round((pianificate / totali) * 100), 100)
}

export function getInitials(nome: string): string {
  return nome
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateAvatarColor(id: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
  ]
  const idx = id.charCodeAt(0) % colors.length
  return colors[idx]
}

/** Returns a normalized tel: href with +39 prefix if no international prefix present. */
export function telHref(tel: string): string {
  const t = tel.trim()
  if (t.startsWith('+')) return t
  if (t.startsWith('00')) return `+${t.slice(2)}`
  return `+39${t.replace(/[\s\-().]/g, '')}`
}
