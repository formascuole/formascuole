import { School, Monitor, RefreshCw, BedDouble, Sun, FlaskConical } from 'lucide-react'

interface ModalitaIconProps {
  modalita?: string | null
  tipo: string
  size?: number
  showTooltip?: boolean
}

export function ModalitaIcon({ modalita, tipo, size = 18, showTooltip = true }: ModalitaIconProps) {
  let Icon: React.ComponentType<{ size?: number; color?: string }>
  let color: string
  let tooltip: string

  if (tipo === 'Lab' && (!modalita || modalita === 'presenza')) {
    Icon = FlaskConical
    color = '#EF4444'
    tooltip = 'Laboratorio sul campo'
  } else if (modalita === 'residenziale') {
    Icon = BedDouble
    color = '#D97706'
    tooltip = 'Residenziale — con pernottamento'
  } else if (modalita === 'semi_residenziale') {
    Icon = Sun
    color = '#F59E0B'
    tooltip = 'Semi-residenziale — solo giornate'
  } else if (modalita === 'online') {
    Icon = Monitor
    color = '#10B981'
    tooltip = 'Online sincrono'
  } else if (modalita === 'ibrido') {
    Icon = RefreshCw
    color = '#8B5CF6'
    tooltip = 'Modalità ibrida'
  } else {
    Icon = School
    color = '#3B82F6'
    tooltip = 'In presenza — presso la scuola'
  }

  return (
    <span title={showTooltip ? tooltip : undefined} className="inline-flex items-center shrink-0">
      <Icon size={size} color={color} />
    </span>
  )
}
