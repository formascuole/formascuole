'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

const TIPO_LABELS: Record<string, string> = {
  assegnazione: 'Email assegnazione',
  sollecito_1: 'Sollecito 1',
  sollecito_2: 'Sollecito 2',
  sollecito_3: 'Sollecito 3 (finale)',
  reminder_sessione: 'Reminder sessione',
  reminder_accettazione: 'Reminder accettazione',
  reminder_questionario: 'Reminder questionario',
  reminder_candidatura: 'Reminder candidatura',
  notifica_calendario_completo: 'Calendario completo',
  notifica_corso_concluso: 'Corso concluso',
  calendario_inviato_scuola: 'Calendario inviato',
}
const TIPO_COLORS: Record<string, string> = {
  assegnazione: 'bg-green-100 text-green-700',
  sollecito_1: 'bg-yellow-100 text-yellow-700',
  sollecito_2: 'bg-orange-100 text-orange-700',
  sollecito_3: 'bg-red-100 text-red-700',
  reminder_sessione: 'bg-blue-100 text-blue-700',
  reminder_accettazione: 'bg-purple-100 text-purple-700',
  reminder_questionario: 'bg-indigo-100 text-indigo-700',
  reminder_candidatura: 'bg-pink-100 text-pink-700',
  notifica_calendario_completo: 'bg-teal-100 text-teal-700',
  notifica_corso_concluso: 'bg-gray-100 text-gray-700',
  calendario_inviato_scuola: 'bg-cyan-100 text-cyan-700',
}

type Notifica = {
  id: string
  tipo: string
  sent_at: string
  formatore?: { id: string; nome: string; avatar_initials: string } | null
  corso?: { title: string; progetti?: { school_name: string } | null } | null
}

interface Props {
  solleciti: Notifica[]
  initialLetteIds: string[]
}

export function NotificheClient({ solleciti, initialLetteIds }: Props) {
  const router = useRouter()
  const [readIds, setReadIds] = useState<Set<string>>(new Set(initialLetteIds))

  const markRead = useCallback(async (id: string) => {
    if (readIds.has(id)) return
    setReadIds(prev => new Set([...prev, id]))
    await fetch(`/api/notifiche/${id}/read`, { method: 'POST' })
    router.refresh()
  }, [readIds, router])

  const markAllRead = useCallback(async () => {
    const unread = solleciti.filter(s => !readIds.has(s.id))
    if (unread.length === 0) return
    const newIds = new Set([...readIds, ...unread.map(s => s.id)])
    setReadIds(newIds)
    await Promise.all(unread.map(s => fetch(`/api/notifiche/${s.id}/read`, { method: 'POST' })))
    router.refresh()
  }, [solleciti, readIds, router])

  const unreadCount = solleciti.filter(s => !readIds.has(s.id)).length

  return (
    <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Storico notifiche</h2>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            Segna tutte come lette ({unreadCount})
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {solleciti.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Nessuna notifica inviata</div>
        ) : (
          solleciti.map((s) => {
            const isRead = readIds.has(s.id)
            return (
              <div
                key={s.id}
                onClick={() => markRead(s.id)}
                className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors ${isRead ? 'bg-white' : 'bg-blue-50/30 hover:bg-blue-50/50'}`}
              >
                <div className="relative shrink-0">
                  {s.formatore && (
                    <Avatar nome={s.formatore.nome} id={s.formatore.id} initials={s.formatore.avatar_initials} size="sm" />
                  )}
                  {!isRead && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm text-gray-900 ${isRead ? 'font-normal' : 'font-medium'}`}>
                    {s.formatore?.nome || '—'}
                  </div>
                  <div className="text-xs text-gray-400">{s.corso?.title} · {s.corso?.progetti?.school_name}</div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${TIPO_COLORS[s.tipo] || 'bg-gray-100 text-gray-600'}`}>
                  {TIPO_LABELS[s.tipo] || s.tipo}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(s.sent_at)}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
