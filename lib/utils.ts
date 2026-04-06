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
  }
  return labels[status]
}

export function getStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
  }
  return colors[status]
}

export function getTipoLabel(tipo: CorsoTipo): string {
  return tipo === 'PF' ? 'Percorso Formativo' : 'Laboratorio'
}

export function getTipoColor(tipo: CorsoTipo): string {
  return tipo === 'PF' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
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
