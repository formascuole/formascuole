'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarioGrid, CalendarioEvent, SessioneCalendarioEvent, IndisponibilitaCalendarioEvent } from '@/components/calendario/CalendarioGrid'

export type FinanziamentoRow = { id: string; nome: string }

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
  ora_inizio: string | null
  ora_fine: string | null
  modalita_sessione: string | null
  tipo: string | null
  corso_modalita: string | null
  calendario_confermato: boolean | null
  finanziamento_id: string | null
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
  finanziamenti: FinanziamentoRow[]
  currentUserId: string
}

export function CalendarioClient({
  initialSessioni,
  initialIndisponibilita,
  formatori,
  progetti,
  finanziamenti,
  currentUserId,
}: Props) {
  const router = useRouter()
  const [sessioni, setSessioni] = useState<SessioneRow[]>(initialSessioni)
  const [indisponibilita, setIndisponibilita] = useState<IndisponibilitaRow[]>(initialIndisponibilita)
  const [filterFormatore, setFilterFormatore] = useState('')
  const [filterProgetto, setFilterProgetto] = useState('')
  const [showIndisponibilita, setShowIndisponibilita] = useState(true)

  // Searchable select state
  const [searchFormatore, setSearchFormatore] = useState('')
  const [openFormatore, setOpenFormatore] = useState(false)
  const [searchScuola, setSearchScuola] = useState('')
  const [openScuola, setOpenScuola] = useState(false)
  const [filterFinanziamento, setFilterFinanziamento] = useState('')
  const [searchFinanziamento, setSearchFinanziamento] = useState('')
  const [openFinanziamento, setOpenFinanziamento] = useState(false)
  const refFormatore = useRef<HTMLDivElement>(null)
  const refScuola = useRef<HTMLDivElement>(null)
  const refFinanziamento = useRef<HTMLDivElement>(null)

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (refFormatore.current && !refFormatore.current.contains(e.target as Node)) setOpenFormatore(false)
      if (refScuola.current && !refScuola.current.contains(e.target as Node)) setOpenScuola(false)
      if (refFinanziamento.current && !refFinanziamento.current.contains(e.target as Node)) setOpenFinanziamento(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatoriFiltered = formatori.filter(f =>
    !searchFormatore || f.nome.toLowerCase().includes(searchFormatore.toLowerCase())
  )
  const scuoleFiltered = progetti.filter(p =>
    !searchScuola || p.school_name.toLowerCase().includes(searchScuola.toLowerCase())
  )
  const finanziamentiFiltered = finanziamenti.filter(f =>
    !searchFinanziamento || f.nome.toLowerCase().includes(searchFinanziamento.toLowerCase())
  )
  const formatoreLabel = filterFormatore ? (formatori.find(f => f.id === filterFormatore)?.nome ?? 'Tutti i formatori') : 'Tutti i formatori'
  const scuolaLabel = filterProgetto ? (progetti.find(p => p.id === filterProgetto)?.school_name ?? 'Tutte le scuole') : 'Tutte le scuole'
  const finanziamentoLabel = filterFinanziamento ? (finanziamenti.find(f => f.id === filterFinanziamento)?.nome ?? 'Tutti i finanziamenti') : 'Tutti i finanziamenti'

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
      ora_inizio: s.ora_inizio,
      ora_fine: s.ora_fine,
      modalita_sessione: s.modalita_sessione,
      tipo: s.tipo,
      corso_modalita: s.corso_modalita,
      calendario_confermato: s.calendario_confermato,
      finanziamento_id: s.finanziamento_id,
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
    if (filterFinanziamento) {
      combined = combined.filter(ev =>
        ev.kind === 'sessione' ? (ev as SessioneCalendarioEvent).finanziamento_id === filterFinanziamento : true
      )
    }

    return combined
  }, [sessioni, indisponibilita, filterFormatore, filterProgetto, filterFinanziamento, showIndisponibilita])

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
        {/* Formatore searchable select */}
        <div ref={refFormatore} className="relative">
          <button
            type="button"
            onClick={() => { setOpenFormatore(v => !v); setSearchFormatore('') }}
            className={`text-sm px-3 py-2 border rounded-[7px] bg-white focus:outline-none transition-colors flex items-center gap-2 min-w-[180px] ${filterFormatore ? 'border-[#d64b55] text-[#d64b55]' : 'border-gray-200 text-gray-700'}`}
          >
            <span className="flex-1 text-left truncate">{formatoreLabel}</span>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="shrink-0 text-gray-400"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {openFormatore && (
            <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-[9px] shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  type="text"
                  placeholder="Cerca formatore..."
                  value={searchFormatore}
                  onChange={e => setSearchFormatore(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-[6px] focus:outline-none focus:border-[#d64b55]"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setFilterFormatore(''); setOpenFormatore(false) }}
                  className={`w-full text-left text-sm px-3 py-2 hover:bg-gray-50 transition-colors ${!filterFormatore ? 'font-medium text-[#d64b55]' : 'text-gray-700'}`}
                >
                  Tutti i formatori
                </button>
                {formatoriFiltered.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setFilterFormatore(f.id); setOpenFormatore(false) }}
                    className={`w-full text-left text-sm px-3 py-2 hover:bg-gray-50 transition-colors ${filterFormatore === f.id ? 'font-medium text-[#d64b55]' : 'text-gray-700'}`}
                  >
                    {f.nome}
                  </button>
                ))}
                {formatoriFiltered.length === 0 && (
                  <div className="text-xs text-gray-400 px-3 py-3 text-center">Nessun risultato</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scuola searchable select */}
        <div ref={refScuola} className="relative">
          <button
            type="button"
            onClick={() => { setOpenScuola(v => !v); setSearchScuola('') }}
            className={`text-sm px-3 py-2 border rounded-[7px] bg-white focus:outline-none transition-colors flex items-center gap-2 min-w-[180px] ${filterProgetto ? 'border-[#d64b55] text-[#d64b55]' : 'border-gray-200 text-gray-700'}`}
          >
            <span className="flex-1 text-left truncate">{scuolaLabel}</span>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="shrink-0 text-gray-400"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {openScuola && (
            <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-[9px] shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  type="text"
                  placeholder="Cerca scuola..."
                  value={searchScuola}
                  onChange={e => setSearchScuola(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-[6px] focus:outline-none focus:border-[#d64b55]"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setFilterProgetto(''); setOpenScuola(false) }}
                  className={`w-full text-left text-sm px-3 py-2 hover:bg-gray-50 transition-colors ${!filterProgetto ? 'font-medium text-[#d64b55]' : 'text-gray-700'}`}
                >
                  Tutte le scuole
                </button>
                {scuoleFiltered.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setFilterProgetto(p.id); setOpenScuola(false) }}
                    className={`w-full text-left text-sm px-3 py-2 hover:bg-gray-50 transition-colors ${filterProgetto === p.id ? 'font-medium text-[#d64b55]' : 'text-gray-700'}`}
                  >
                    {p.school_name}
                  </button>
                ))}
                {scuoleFiltered.length === 0 && (
                  <div className="text-xs text-gray-400 px-3 py-3 text-center">Nessun risultato</div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Finanziamento searchable select */}
        <div ref={refFinanziamento} className="relative">
          <button
            type="button"
            onClick={() => { setOpenFinanziamento(v => !v); setSearchFinanziamento('') }}
            className={`text-sm px-3 py-2 border rounded-[7px] bg-white focus:outline-none transition-colors flex items-center gap-2 min-w-[180px] ${filterFinanziamento ? 'border-[#d64b55] text-[#d64b55]' : 'border-gray-200 text-gray-700'}`}
          >
            <span className="flex-1 text-left truncate">{finanziamentoLabel}</span>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="shrink-0 text-gray-400"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {openFinanziamento && (
            <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-[9px] shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  type="text"
                  placeholder="Cerca finanziamento..."
                  value={searchFinanziamento}
                  onChange={e => setSearchFinanziamento(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-[6px] focus:outline-none focus:border-[#d64b55]"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setFilterFinanziamento(''); setOpenFinanziamento(false) }}
                  className={`w-full text-left text-sm px-3 py-2 hover:bg-gray-50 transition-colors ${!filterFinanziamento ? 'font-medium text-[#d64b55]' : 'text-gray-700'}`}
                >
                  Tutti i finanziamenti
                </button>
                {finanziamentiFiltered.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setFilterFinanziamento(f.id); setOpenFinanziamento(false) }}
                    className={`w-full text-left text-sm px-3 py-2 hover:bg-gray-50 transition-colors ${filterFinanziamento === f.id ? 'font-medium text-[#d64b55]' : 'text-gray-700'}`}
                  >
                    {f.nome}
                  </button>
                ))}
                {finanziamentiFiltered.length === 0 && (
                  <div className="text-xs text-gray-400 px-3 py-3 text-center">Nessun risultato</div>
                )}
              </div>
            </div>
          )}
        </div>

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
