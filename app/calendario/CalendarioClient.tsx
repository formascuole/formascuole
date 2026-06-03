'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarioGrid, CalendarioEvent, SessioneCalendarioEvent, IndisponibilitaCalendarioEvent } from '@/components/calendario/CalendarioGrid'

export type SessioneRow = {
  id: string
  data: string
  ore: number
  completata: boolean
  corso_id: string
  corso_title: string
  school_name: string
  project_id: string
  formatore_id: string | null
  formatore_nome: string | null
}

export type IndisponibilitaRow = {
  id: string
  formatore_id: string
  formatore_nome: string | null
  data: string
  fascia: 'mattina' | 'pomeriggio' | 'tutto_il_giorno'
  note: string | null
}

interface Props {
  initialSessioni: SessioneRow[]
  initialIndisponibilita: IndisponibilitaRow[]
  formatori: { id: string; nome: string }[]
  progetti: { id: string; school_name: string }[]
  currentUserId: string
}

export function CalendarioClient({
  initialSessioni,
  initialIndisponibilita,
  formatori,
  progetti,
  currentUserId,
}: Props) {
  const router = useRouter()
  const [sessioni, setSessioni] = useState<SessioneRow[]>(initialSessioni)
  const [indisponibilita, setIndisponibilita] = useState<IndisponibilitaRow[]>(initialIndisponibilita)
  const [filterFormatore, setFilterFormatore] = useState('')
  const [filterProgetto, setFilterProgetto] = useState('')
  const [showIndisponibilita, setShowIndisponibilita] = useState(true)

  useEffect(() => { setSessioni(initialSessioni) }, [initialSessioni])
  useEffect(() => { setIndisponibilita(initialIndisponibilita) }, [initialIndisponibilita])

  const events = useMemo((): CalendarioEvent[] => {
    const sessEvs: SessioneCalendarioEvent[] = sessioni.map(s => ({
      kind: 'sessione',
      id: s.id,
      data: s.data,
      ore: s.ore,
      completata: s.completata,
      corso_id: s.corso_id,
      corso_title: s.corso_title,
      school_name: s.school_name,
      project_id: s.project_id,
      formatore_id: s.formatore_id,
      formatore_nome: s.formatore_nome,
    }))

    const indEvs: IndisponibilitaCalendarioEvent[] = (showIndisponibilita && !filterProgetto)
      ? indisponibilita.map(i => ({
          kind: 'indisponibilita',
          id: i.id,
          formatore_id: i.formatore_id,
          formatore_nome: i.formatore_nome,
          data: i.data,
          fascia: i.fascia,
          note: i.note,
        }))
      : []

    let combined: CalendarioEvent[] = [...sessEvs, ...indEvs]

    if (filterFormatore) {
      combined = combined.filter(ev => ev.formatore_id === filterFormatore)
    }
    if (filterProgetto) {
      combined = combined.filter(ev =>
        ev.kind === 'sessione' ? ev.project_id === filterProgetto : true
      )
    }

    return combined
  }, [sessioni, indisponibilita, filterFormatore, filterProgetto, showIndisponibilita])

  const handleDeleteIndisponibilita = async (id: string) => {
    const res = await fetch(`/api/indisponibilita/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Errore')
    }
    setIndisponibilita(prev => prev.filter(i => i.id !== id))
    router.refresh()
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <p className="text-sm text-gray-500 mt-1">Sessioni e disponibilità di tutti i formatori</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterFormatore}
          onChange={e => setFilterFormatore(e.target.value)}
          className="text-sm px-3 py-2 border border-gray-200 rounded-[7px] text-gray-700 bg-white focus:outline-none focus:border-[#d64b55] transition-colors appearance-none"
        >
          <option value="">Tutti i formatori</option>
          {formatori.map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
        <select
          value={filterProgetto}
          onChange={e => setFilterProgetto(e.target.value)}
          className="text-sm px-3 py-2 border border-gray-200 rounded-[7px] text-gray-700 bg-white focus:outline-none focus:border-[#d64b55] transition-colors appearance-none"
        >
          <option value="">Tutte le scuole</option>
          {progetti.map(p => (
            <option key={p.id} value={p.id}>{p.school_name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setShowIndisponibilita(v => !v)}
            className={`relative w-8 h-4 rounded-full transition-colors ${showIndisponibilita ? 'bg-[#EA580C]' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${showIndisponibilita ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-600">Indisponibilità</span>
        </label>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl p-6" style={{ border: '0.5px solid #e5e5e5' }}>
        <CalendarioGrid
          events={events}
          isAdmin
          currentUserId={currentUserId}
          onDeleteIndisponibilita={handleDeleteIndisponibilita}
        />
      </div>
    </div>
  )
}
