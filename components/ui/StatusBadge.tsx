import { ProjectStatus, CorsoTipo } from '@/lib/types'

type BadgeVariant = ProjectStatus | CorsoTipo | 'warning' | 'info'

interface StatusBadgeProps {
  variant: BadgeVariant
  label?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ variant, label, size = 'md' }: StatusBadgeProps) {
  const configs: Record<BadgeVariant, { label: string; className: string }> = {
    active: { label: 'Attivo', className: 'bg-green-100 text-green-700' },
    pending: { label: 'In attesa', className: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completato', className: 'bg-blue-100 text-blue-700' },
    PF: { label: 'Percorso Formativo', className: 'bg-purple-100 text-purple-700' },
    Lab: { label: 'Laboratorio', className: 'bg-orange-100 text-orange-700' },
    MF: { label: 'Mod. Formativo', className: 'bg-green-100 text-green-700' },
    warning: { label: 'Attenzione', className: 'bg-red-100 text-red-700' },
    info: { label: 'Info', className: 'bg-gray-100 text-gray-600' },
  }

  const config = configs[variant]
  const text = label || config.label
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span className={`inline-flex items-center font-medium rounded-md ${sizeClass} ${config.className}`}>
      {text}
    </span>
  )
}
