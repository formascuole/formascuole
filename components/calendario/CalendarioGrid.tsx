'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export type SessioneCalendarioEvent = {
  kind: 'sessione'
  id: string
  data: string
  ore: number
  completata: boolean
  corso_id: string
  corso_title: string
  school_name: string
  project_id: string
  formatore_id?: string | null
  formatore_nome?: string | null
}

export type IndisponibilitaCalendarioEvent = {
  kind: 'indisponibilita'
  id: string
  formatore_id: string
  formatore_nome?: string | null
  data: string
  fascia: 'mattina' | 'pomeriggio' | 'tutto_il_giorno'
  note?: string | null
}

export type CalendarioEvent = SessioneCalendarioEvent | IndisponibilitaCalendarioEvent

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAYS_SHORT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

const FASCIA_LABELS: Record<string, string> = {
  mattina: 'Mattina',
  pomeriggio: 'Pomeriggio',
  tutto_il_giorno: 'Tutto il giorno',
}

function getEventColors(ev: CalendarioEvent): { bg: string; color: string } {
  if (ev.kind === 'sessione') {
    return ev.completata ? { bg: '#1D9E75', color: '#fff' } : { bg: '#378ADD', color: '#fff' }
  }
  if (ev.fascia === 'mattina') return { bg: '#FED7AA', color: '#9A3412' }
  if (ev.fascia === 'pomeriggio') return { bg: '#FB923C', color: '#fff' }
  return { bg: '#EA580C', color: '#fff' }
}

function getEventLabel(ev: CalendarioEvent): string {
  if (ev.kind === 'sessione') return ev.corso_title
  return FASCIA_LABELS[ev.fascia] || ev.fascia
}

function formatDateIT(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

interface CalendarioGridProps {
  events: CalendarioEvent[]
  isAdmin: boolean
  currentUserId: string
  onDeleteIndisponibilita?: (id: string) => Promise<void>
  onDayClick?: (dateStr: string) => void
}

export function CalendarioGrid({
  events,
  isAdmin,
  currentUserId,
  onDeleteIndisponibilita,
  onDayClick,
}: CalendarioGridProps) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const [view, setView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarioEvent | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { calDays, weekDays, headerLabel } = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const d = currentDate.getDate()

    if (view === 'month') {
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const firstDow = new Date(y, m, 1).getDay()
      const startPad = (firstDow + 6) % 7
      const days: (string | null)[] = [
        ...Array(startPad).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) =>
          `${y}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
        ),
      ]
      while (days.length % 7 !== 0) days.push(null)
      return { calDays: days, weekDays: [] as string[], headerLabel: `${MONTHS_IT[m]} ${y}` }
    }

    const dow = new Date(y, m, d).getDay()
    const monday = new Date(y, m, d - ((dow + 6) % 7))
    const wdays = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      return day.toISOString().split('T')[0]
    })
    const start = new Date(wdays[0] + 'T12:00:00')
    const end = new Date(wdays[6] + 'T12:00:00')
    let label: string
    if (start.getMonth() === end.getMonth()) {
      label = `${start.getDate()}–${end.getDate()} ${MONTHS_IT[start.getMonth()]} ${start.getFullYear()}`
    } else {
      label = `${start.getDate()} ${MONTHS_IT[start.getMonth()]} – ${end.getDate()} ${MONTHS_IT[end.getMonth()]} ${end.getFullYear()}`
    }
    return { calDays: [] as (string | null)[], weekDays: wdays, headerLabel: label }
  }, [view, currentDate])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarioEvent[]> = {}
    events.forEach(ev => {
      if (!map[ev.data]) map[ev.data] = []
      map[ev.data].push(ev)
    })
    return map
  }, [events])

  const goBack = () => setCurrentDate(prev => {
    const n = new Date(prev)
    if (view === 'month') n.setMonth(n.getMonth() - 1)
    else n.setDate(n.getDate() - 7)
    return n
  })

  const goForward = () => setCurrentDate(prev => {
    const n = new Date(prev)
    if (view === 'month') n.setMonth(n.getMonth() + 1)
    else n.setDate(n.getDate() + 7)
    return n
  })

  const handleDelete = async (id: string) => {
    if (!onDeleteIndisponibilita) return
    setDeletingId(id)
    try {
      await onDeleteIndisponibilita(id)
      setSelectedEvent(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {/* Nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            onClick={goForward}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="font-semibold text-gray-900 ml-1">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs font-medium px-3 py-1.5 rounded-[7px] border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Oggi
          </button>
          <div className="flex rounded-[7px] border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={`text-xs font-medium px-3 py-1.5 transition-colors ${view === 'month' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              style={view === 'month' ? { backgroundColor: '#d64b55' } : {}}
            >
              Mese
            </button>
            <button
              onClick={() => setView('week')}
              className={`text-xs font-medium px-3 py-1.5 border-l border-gray-200 transition-colors ${view === 'week' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              style={view === 'week' ? { backgroundColor: '#d64b55' } : {}}
            >
              Settimana
            </button>
          </div>
        </div>
      </div>

      {/* Month view */}
      {view === 'month' && (
        <>
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS_SHORT.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-gray-100">
            {calDays.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={idx} className="border-r border-b border-gray-100 min-h-[110px] bg-gray-50/30" />
              }
              const dayEvs = eventsByDate[dateStr] || []
              const isToday = dateStr === todayStr
              const dayNum = Number(dateStr.split('-')[2])
              const shown = dayEvs.slice(0, 3)
              const extra = dayEvs.length - 3
              const canAdd = dayEvs.length === 0 && !!onDayClick
              return (
                <div
                  key={idx}
                  className={`border-r border-b border-gray-100 min-h-[110px] p-1.5 group ${canAdd ? 'cursor-pointer hover:bg-gray-50/80' : ''}`}
                  onClick={() => canAdd && onDayClick(dateStr)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'text-white' : 'text-gray-500'}`}
                      style={isToday ? { backgroundColor: '#d64b55' } : {}}
                    >
                      {dayNum}
                    </span>
                    {canAdd && (
                      <span className="text-xs text-gray-200 group-hover:text-gray-400 transition-colors pr-1 select-none">+</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {shown.map((ev, i) => {
                      const col = getEventColors(ev)
                      return (
                        <button
                          key={`${ev.id}-${i}`}
                          onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                          className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate block leading-5"
                          style={{ backgroundColor: col.bg, color: col.color }}
                        >
                          {getEventLabel(ev)}
                        </button>
                      )
                    })}
                    {extra > 0 && (
                      <div className="text-xs text-gray-400 pl-1">+{extra} altri</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className="grid grid-cols-7 border-l border-t border-gray-100">
          {weekDays.map(dateStr => {
            const dayEvs = eventsByDate[dateStr] || []
            const isToday = dateStr === todayStr
            const dayNum = Number(dateStr.split('-')[2])
            const d = new Date(dateStr + 'T12:00:00')
            const dow = DAYS_SHORT[(d.getDay() + 6) % 7]
            return (
              <div key={dateStr} className="border-r border-b border-gray-100 min-h-[320px] p-2">
                <div className="flex flex-col items-center mb-2">
                  <span className="text-xs text-gray-400 mb-0.5">{dow}</span>
                  <span
                    className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'text-white' : 'text-gray-700'}`}
                    style={isToday ? { backgroundColor: '#d64b55' } : {}}
                  >
                    {dayNum}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvs.map((ev, i) => {
                    const col = getEventColors(ev)
                    return (
                      <button
                        key={`${ev.id}-${i}`}
                        onClick={() => setSelectedEvent(ev)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded-[5px] block"
                        style={{ backgroundColor: col.bg, color: col.color }}
                      >
                        <div className="font-medium truncate">{getEventLabel(ev)}</div>
                        {ev.kind === 'sessione' && (
                          <div className="opacity-75 mt-0.5">{ev.ore}h · {ev.completata ? 'Completata' : 'Pianificata'}</div>
                        )}
                        {ev.kind === 'indisponibilita' && ev.formatore_nome && (
                          <div className="opacity-75 truncate mt-0.5">{ev.formatore_nome}</div>
                        )}
                      </button>
                    )
                  })}
                  {dayEvs.length === 0 && onDayClick && (
                    <button
                      onClick={() => onDayClick(dateStr)}
                      className="w-full py-3 text-xs text-gray-300 hover:text-gray-400 border border-dashed border-gray-200 hover:border-gray-300 rounded-[5px] transition-colors"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {([
          { bg: '#378ADD', label: 'Sessione pianificata' },
          { bg: '#1D9E75', label: 'Sessione completata' },
          { bg: '#FED7AA', label: 'Indisp. mattina', border: '#FB923C' },
          { bg: '#FB923C', label: 'Indisp. pomeriggio' },
          { bg: '#EA580C', label: 'Indisp. tutto il giorno' },
        ] as { bg: string; label: string; border?: string }[]).map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: item.bg, border: item.border ? `1px solid ${item.border}` : undefined }}
            />
            <span className="text-xs text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          deletingId={deletingId}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function EventDetailModal({
  event,
  isAdmin,
  currentUserId,
  deletingId,
  onClose,
  onDelete,
}: {
  event: CalendarioEvent
  isAdmin: boolean
  currentUserId: string
  deletingId: string | null
  onClose: () => void
  onDelete: (id: string) => void
}) {
  if (event.kind === 'sessione') {
    return (
      <Modal
        open
        onClose={onClose}
        title={event.corso_title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Chiudi</Button>
            <Link
              href={`/progetti/${event.project_id}/corsi/${event.corso_id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-[7px] text-white transition-colors"
              style={{ backgroundColor: '#d64b55' }}
              onClick={onClose}
            >
              Vai al corso
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </Link>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Scuola</div>
            <div className="text-sm text-gray-800">{event.school_name}</div>
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Data</div>
              <div className="text-sm text-gray-800">{formatDateIT(event.data)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Ore</div>
              <div className="text-sm text-gray-800">{event.ore}h</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Stato</div>
            <span
              className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md text-white"
              style={{ backgroundColor: event.completata ? '#1D9E75' : '#378ADD' }}
            >
              {event.completata ? 'Completata' : 'Pianificata'}
            </span>
          </div>
          {event.formatore_nome && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Formatore</div>
              <div className="text-sm text-gray-800">{event.formatore_nome}</div>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const isPast = event.data < todayStr
  const canDelete = isAdmin || event.formatore_id === currentUserId
  const canDeleteNow = canDelete && (isAdmin || !isPast)

  return (
    <Modal
      open
      onClose={onClose}
      title="Indisponibilità"
      size="sm"
      footer={
        canDeleteNow
          ? (
            <>
              <Button variant="secondary" onClick={onClose}>Chiudi</Button>
              <button
                onClick={() => onDelete(event.id)}
                disabled={deletingId === event.id}
                className="text-sm font-medium px-4 py-2 rounded-[7px] text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#d64b55' }}
              >
                {deletingId === event.id ? 'Eliminando...' : 'Elimina'}
              </button>
            </>
          )
          : <Button variant="secondary" onClick={onClose}>Chiudi</Button>
      }
    >
      <div className="space-y-3">
        {event.formatore_nome && (
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Formatore</div>
            <div className="text-sm text-gray-800">{event.formatore_nome}</div>
          </div>
        )}
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Data</div>
            <div className="text-sm text-gray-800">{formatDateIT(event.data)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Fascia</div>
            <div className="text-sm text-gray-800">{FASCIA_LABELS[event.fascia]}</div>
          </div>
        </div>
        {event.note && (
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Note</div>
            <div className="text-sm text-gray-800">{event.note}</div>
          </div>
        )}
        {canDelete && isPast && !isAdmin && (
          <p className="text-xs text-gray-400 italic">Non puoi eliminare indisponibilità passate.</p>
        )}
      </div>
    </Modal>
  )
}
