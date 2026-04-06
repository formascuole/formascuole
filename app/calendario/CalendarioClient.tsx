'use client'
import { useState, useMemo } from 'react'
import { Sessione } from '@/lib/types'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface SessioneConCorso extends Sessione {
  corso?: {
    id: string
    title: string
    project_id: string
    tipo: 'PF' | 'Lab'
    progetti?: { school_name: string }
  }
}

interface CalendarioClientProps {
  sessioni: SessioneConCorso[]
}

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAYS_IT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

export function CalendarioClient({ sessioni }: CalendarioClientProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  // Convert Sunday=0 to Monday=0 grid
  const startPad = (firstDayOfMonth + 6) % 7

  const sessioniByDate = useMemo(() => {
    const map: Record<string, SessioneConCorso[]> = {}
    sessioni.forEach(s => {
      if (!map[s.data]) map[s.data] = []
      map[s.data].push(s)
    })
    return map
  }, [sessioni])

  const upcomingSessioni = useMemo(() =>
    sessioni
      .filter(s => s.data >= today.toISOString().split('T')[0])
      .slice(0, 10),
    [sessioni]
  )

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const days: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <p className="text-sm text-gray-500 mt-1">Tutte le sessioni pianificate</p>
      </div>

      <div className="flex gap-6">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-xl p-6" style={{ border: '0.5px solid #e5e5e5' }}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-gray-100 transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <h2 className="font-semibold text-gray-900">{MONTHS_IT[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-[7px] hover:bg-gray-100 transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_IT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (!day) return <div key={idx} />
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hasSessions = !!sessioniByDate[dateStr]
              const isToday = dateStr === today.toISOString().split('T')[0]
              return (
                <div
                  key={idx}
                  className={`aspect-square flex flex-col items-center justify-center rounded-[7px] relative cursor-default ${
                    isToday ? 'text-white font-bold' : hasSessions ? 'font-medium text-gray-900' : 'text-gray-400'
                  }`}
                  style={isToday ? { backgroundColor: '#d64b55' } : hasSessions ? { backgroundColor: '#fbeced' } : {}}
                  title={hasSessions ? `${sessioniByDate[dateStr].length} sessione/i` : undefined}
                >
                  <span className="text-sm">{day}</span>
                  {hasSessions && !isToday && (
                    <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: '#d64b55' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming sessions */}
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
            <div className="px-4 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900">Prossime sessioni</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
              {upcomingSessioni.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">Nessuna sessione in programma</div>
              ) : (
                upcomingSessioni.map(s => (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">{s.corso?.title || '—'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{s.corso?.progetti?.school_name || '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{s.data} · {s.ore}h</div>
                      </div>
                      {s.corso?.tipo && <StatusBadge variant={s.corso.tipo as 'PF' | 'Lab'} size="sm" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
