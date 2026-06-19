import { RUOLO_BADGE } from '@/lib/ruolo-referente'

export function RuoloBadge({ ruolo }: { ruolo?: string | null }) {
  if (!ruolo) return null
  const c = RUOLO_BADGE[ruolo] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${c.bg} ${c.text}`}>
      {ruolo}
    </span>
  )
}
