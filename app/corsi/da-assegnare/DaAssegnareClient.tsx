'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CorsoDA {
  id: string
  title: string
  tipo: string | null
  ore_totali: number
  modalita: string | null
  project_id: string
  tariffa_oraria: number | null
  tags: string[]
}

export interface ProgettoDA {
  id: string
  school_name: string
  status: 'active' | 'pending'
  address: string | null
  finanziamento_id: string | null
  regione: string | null
  provincia: string | null
}

export interface FormatoreDA {
  id: string
  nome: string
  email: string
  avatar_initials: string
  tariffa_oraria_formatore: number | null
  regione: string | null
  indirizzo_citta: string | null
  indirizzo_provincia: string | null
}

interface ScoredFormatore {
  formatore: FormatoreDA
  score: number
  skillMatches: number
  totalTags: number
  sameRegion: boolean | null
  oreWarning: boolean
  noTariffa: boolean
  oreAssegnate: number
}

interface Props {
  corsi: CorsoDA[]
  progetti: ProgettoDA[]
  finanziamenti: { id: string; nome: string }[]
  formatori: FormatoreDA[]
  formatoriSkills: Record<string, string[]>
  oreAssegnateMap: Record<string, number>
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const PRESENZA_MODALITA = new Set(['in_presenza', 'residenziale', 'semi_residenziale'])

function computeScores(
  formatori: FormatoreDA[],
  corso: CorsoDA,
  progetto: ProgettoDA,
  formatoriSkills: Record<string, string[]>,
  oreAssegnateMap: Record<string, number>,
): ScoredFormatore[] {
  const isPresenza = PRESENZA_MODALITA.has(corso.modalita || '')
  const corsoTagSet = new Set(corso.tags)

  return formatori
    .map(f => {
      const fTags = formatoriSkills[f.id] || []
      const skillMatches = fTags.filter(t => corsoTagSet.has(t)).length
      const skillScore = corso.tags.length > 0 ? Math.round((skillMatches / corso.tags.length) * 60) : 0

      const sameRegion =
        isPresenza && progetto.regione != null && f.regione != null
          ? f.regione === progetto.regione
          : null
      const regionScore = sameRegion === true ? 40 : 0

      const oreAssegnate = oreAssegnateMap[f.id] || 0
      const oreWarning = oreAssegnate + corso.ore_totali > 200
      const noTariffa = !f.tariffa_oraria_formatore && !corso.tariffa_oraria

      return {
        formatore: f,
        score: skillScore + regionScore,
        skillMatches,
        totalTags: corso.tags.length,
        sameRegion,
        oreWarning,
        noTariffa,
        oreAssegnate,
      }
    })
    .sort((a, b) => b.score - a.score)
}

// ── Helper components ─────────────────────────────────────────────────────────

const BADGE_PALETTE = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#cffafe', text: '#155e75' },
  { bg: '#ffedd5', text: '#9a3412' },
]
function badgeColor(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0x7fffffff
  return BADGE_PALETTE[h % BADGE_PALETTE.length]
}

function ProjectStatusBadge({ status }: { status: 'active' | 'pending' }) {
  return status === 'active' ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      Attivo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
      In attesa
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PF: { bg: '#dbeafe', text: '#1e40af', label: 'PF' },
    Lab: { bg: '#dcfce7', text: '#166534', label: 'Lab' },
    MF: { bg: '#ede9fe', text: '#5b21b6', label: 'MF' },
  }
  const style = map[tipo] ?? { bg: '#f3f4f6', text: '#374151', label: tipo }
  return (
    <span className="text-xs font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{ backgroundColor: style.bg, color: style.text }}>
      {style.label}
    </span>
  )
}

function ModalitaIcon({ modalita }: { modalita: string }) {
  if (PRESENZA_MODALITA.has(modalita)) {
    return (
      <span title="In presenza" className="text-gray-400 shrink-0">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
    )
  }
  if (modalita === 'a_distanza') {
    return (
      <span title="A distanza" className="text-gray-400 shrink-0">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
    )
  }
  return (
    <span title="Blended" className="text-gray-400 shrink-0">
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 3a9 9 0 010 18" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    </span>
  )
}

// ── FormatoreCard ─────────────────────────────────────────────────────────────

function FormatoreCard({ scored, onAssign }: { scored: ScoredFormatore; onAssign: () => void }) {
  const { formatore, score, totalTags, sameRegion, oreWarning, noTariffa, oreAssegnate } = scored
  const pct = Math.min(score, 100)

  return (
    <button
      onClick={onAssign}
      className="text-left w-full p-3 rounded-lg border transition-all hover:shadow-sm"
      style={{ borderColor: '#e5e5e5', backgroundColor: 'white' }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = '#d64b55'
        ;(e.currentTarget as HTMLElement).style.backgroundColor = '#fff8f8'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5'
        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'white'
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: '#d64b55' }}
        >
          {formatore.avatar_initials || formatore.nome.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-900 truncate leading-tight">{formatore.nome}</span>
      </div>

      {(formatore.indirizzo_citta || formatore.indirizzo_provincia) && (
        <div className="text-xs text-gray-400 mb-2 truncate">
          {formatore.indirizzo_citta}
          {formatore.indirizzo_provincia ? ` (${formatore.indirizzo_provincia})` : ''}
        </div>
      )}

      {totalTags > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-gray-400">Match</span>
            <span className="text-[10px] font-semibold text-gray-700">{pct}%</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: pct >= 60 ? '#22c55e' : pct >= 30 ? '#f59e0b' : '#d64b55' }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {noTariffa && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">⚠ Tariffa</span>
        )}
        {oreWarning && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
            ⚠ {oreAssegnate + ''}h+
          </span>
        )}
        {sameRegion === true && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">Stessa reg.</span>
        )}
        {sameRegion === false && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Altra reg.</span>
        )}
      </div>
    </button>
  )
}

// ── CorsoRow ──────────────────────────────────────────────────────────────────

interface CorsoRowProps {
  corso: CorsoDA
  progetto: ProgettoDA
  formatori: FormatoreDA[]
  formatoriSkills: Record<string, string[]>
  oreAssegnateMap: Record<string, number>
  isPickerOpen: boolean
  onTogglePicker: () => void
  onAssign: (corsoId: string, formatoreId: string) => Promise<void>
  isAssigning: boolean
}

function CorsoRow({
  corso, progetto, formatori, formatoriSkills, oreAssegnateMap,
  isPickerOpen, onTogglePicker, onAssign, isAssigning,
}: CorsoRowProps) {
  const scores = useMemo(() => {
    if (!isPickerOpen) return null
    return computeScores(formatori, corso, progetto, formatoriSkills, oreAssegnateMap)
  }, [isPickerOpen, formatori, corso, progetto, formatoriSkills, oreAssegnateMap])

  const suggested = scores?.filter(s => s.score > 0) ?? []
  const others = scores?.filter(s => s.score === 0) ?? []

  return (
    <div>
      {/* Corso info row */}
      <div className="flex items-center gap-3 px-6 py-3">
        {corso.tipo && <TipoBadge tipo={corso.tipo} />}
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{corso.title}</span>
        <span className="text-sm text-gray-400 shrink-0">{corso.ore_totali}h</span>
        {corso.modalita && <ModalitaIcon modalita={corso.modalita} />}
        <button
          onClick={onTogglePicker}
          disabled={isAssigning}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-[7px] border transition-colors disabled:opacity-60"
          style={isPickerOpen
            ? { borderColor: '#d64b55', color: '#d64b55', backgroundColor: '#fff8f8' }
            : { borderColor: '#e5e5e5', color: '#374151', backgroundColor: 'white' }
          }
        >
          {isAssigning ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/>
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Assegnazione...
            </span>
          ) : isPickerOpen ? 'Chiudi picker' : 'Assegna formatore'}
        </button>
      </div>

      {/* Inline picker */}
      {isPickerOpen && !isAssigning && scores && (
        <div className="px-6 pb-5 pt-3 bg-gray-50 border-t border-gray-100">
          {suggested.length === 0 && others.length === 0 && (
            <p className="text-sm text-gray-400 py-2">Nessun formatore disponibile.</p>
          )}
          {suggested.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Formatori suggeriti</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {suggested.map(s => (
                  <FormatoreCard
                    key={s.formatore.id}
                    scored={s}
                    onAssign={() => onAssign(corso.id, s.formatore.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {suggested.length > 0 ? 'Altri formatori' : 'Formatori'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {others.map(s => (
                  <FormatoreCard
                    key={s.formatore.id}
                    scored={s}
                    onAssign={() => onAssign(corso.id, s.formatore.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DaAssegnareClient({ corsi, progetti, finanziamenti, formatori, formatoriSkills, oreAssegnateMap }: Props) {
  const [filterFinId, setFilterFinId] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending'>('all')
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set(progetti.map(p => p.id)))
  const [pickerCorsoId, setPickerCorsoId] = useState<string | null>(null)
  const [assigningCorsoId, setAssigningCorsoId] = useState<string | null>(null)
  const [assignedCorsiIds, setAssignedCorsiIds] = useState<Set<string>>(new Set())

  const [tariffaMancante, setTariffaMancante] = useState<{ corsoId: string; formatoreId: string; formatoreNome: string } | null>(null)
  const [tariffaInput, setTariffaInput] = useState('')
  const [savingTariffa, setSavingTariffa] = useState(false)
  const [tariffaError, setTariffaError] = useState<string | null>(null)

  const progettiMap = useMemo(() => new Map(progetti.map(p => [p.id, p])), [progetti])
  const finanziamentiMap = useMemo(() => new Map(finanziamenti.map(f => [f.id, f.nome])), [finanziamenti])

  const filteredCorsi = useMemo(() =>
    corsi.filter(c => {
      if (assignedCorsiIds.has(c.id)) return false
      const p = progettiMap.get(c.project_id)
      if (!p) return false
      if (filterFinId && p.finanziamento_id !== filterFinId) return false
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      return true
    }),
    [corsi, assignedCorsiIds, progettiMap, filterFinId, filterStatus]
  )

  const corsiPerProgetto = useMemo(() => {
    const map = new Map<string, CorsoDA[]>()
    for (const c of filteredCorsi) {
      const existing = map.get(c.project_id) || []
      existing.push(c)
      map.set(c.project_id, existing)
    }
    return map
  }, [filteredCorsi])

  const visibleProjects = useMemo(() =>
    progetti
      .filter(p => {
        if (filterStatus !== 'all' && p.status !== filterStatus) return false
        if (filterFinId) {
          const corsiP = corsiPerProgetto.get(p.id)
          if (!corsiP || corsiP.length === 0) return false
        }
        return corsiPerProgetto.has(p.id)
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1
        return a.school_name.localeCompare(b.school_name, 'it')
      }),
    [progetti, corsiPerProgetto, filterStatus, filterFinId]
  )

  const toggleProject = useCallback((id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const doAssign = useCallback(async (corsoId: string, formatoreId: string) => {
    setAssigningCorsoId(corsoId)
    try {
      const res = await fetch(`/api/corsi/${corsoId}/formatore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formatore_id: formatoreId }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'TARIFFA_MANCANTE') {
          setTariffaMancante({ corsoId, formatoreId, formatoreNome: json.formatore_nome })
        }
        return
      }
      setAssignedCorsiIds(prev => new Set([...prev, corsoId]))
      setPickerCorsoId(null)
    } finally {
      setAssigningCorsoId(null)
    }
  }, [])

  const handleSaveTariffaEAssegna = useCallback(async () => {
    if (!tariffaMancante) return
    const val = parseFloat(tariffaInput.replace(',', '.'))
    if (!val || val <= 0) { setTariffaError('Inserisci una tariffa valida'); return }
    setSavingTariffa(true)
    setTariffaError(null)
    try {
      const res = await fetch(`/api/utenti/${tariffaMancante.formatoreId}/tariffa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tariffa_oraria_formatore: val }),
      })
      if (!res.ok) { setTariffaError('Errore nel salvataggio della tariffa'); return }
      const { corsoId, formatoreId } = tariffaMancante
      setTariffaMancante(null)
      setTariffaInput('')
      await doAssign(corsoId, formatoreId)
    } finally {
      setSavingTariffa(false)
    }
  }, [tariffaMancante, tariffaInput, doAssign])

  const selectCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corsi da assegnare</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredCorsi.length === 0
              ? 'Nessun corso senza formatore'
              : `${filteredCorsi.length} cors${filteredCorsi.length === 1 ? 'o' : 'i'} senza formatore in ${visibleProjects.length} progett${visibleProjects.length === 1 ? 'o' : 'i'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {finanziamenti.length > 0 && (
            <select value={filterFinId} onChange={e => setFilterFinId(e.target.value)} className={selectCls}>
              <option value="">Tutti i finanziamenti</option>
              {finanziamenti.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          )}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'pending')} className={selectCls}>
            <option value="all">Tutti gli stati</option>
            <option value="active">Attivi</option>
            <option value="pending">In attesa</option>
          </select>
        </div>
      </div>

      {/* Empty state */}
      {visibleProjects.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <svg className="mx-auto mb-4 text-gray-300" width="48" height="48" fill="none" viewBox="0 0 24 24">
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 20a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <polyline points="17 11 19 13 23 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-base font-medium text-gray-500">Tutti i corsi hanno un formatore assegnato</p>
          <p className="text-sm text-gray-400 mt-1">
            <Link href="/progetti" className="hover:underline" style={{ color: '#d64b55' }}>Vai ai progetti →</Link>
          </p>
        </div>
      )}

      {/* Accordion list */}
      <div className="space-y-3">
        {visibleProjects.map(progetto => {
          const corsiProg = corsiPerProgetto.get(progetto.id) || []
          const isExpanded = expandedProjects.has(progetto.id)
          const finNome = progetto.finanziamento_id ? finanziamentiMap.get(progetto.finanziamento_id) : null
          const finColors = finNome ? badgeColor(finNome) : null

          return (
            <div key={progetto.id} className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
              {/* Header */}
              <button
                onClick={() => toggleProject(progetto.id)}
                className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{progetto.school_name}</span>
                    <ProjectStatusBadge status={progetto.status} />
                    {finNome && finColors && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: finColors.bg, color: finColors.text }}>
                        {finNome}
                      </span>
                    )}
                  </div>
                  {progetto.address && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{progetto.address}</p>
                  )}
                </div>
                <span className="text-sm text-gray-500 shrink-0 font-medium">
                  {corsiProg.length} cors{corsiProg.length === 1 ? 'o' : 'i'}
                </span>
                <svg
                  className="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" viewBox="0 0 24 24"
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Body */}
              {isExpanded && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {corsiProg.map(corso => (
                    <CorsoRow
                      key={corso.id}
                      corso={corso}
                      progetto={progetto}
                      formatori={formatori}
                      formatoriSkills={formatoriSkills}
                      oreAssegnateMap={oreAssegnateMap}
                      isPickerOpen={pickerCorsoId === corso.id}
                      onTogglePicker={() => setPickerCorsoId(pickerCorsoId === corso.id ? null : corso.id)}
                      onAssign={doAssign}
                      isAssigning={assigningCorsoId === corso.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tariffa mancante modal */}
      {tariffaMancante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Tariffa mancante</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{tariffaMancante.formatoreNome}</strong> non ha una tariffa impostata nel profilo.
              Inseriscila per procedere con l&apos;assegnazione.
            </p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500 shrink-0">€/h</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tariffaInput}
                onChange={e => setTariffaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTariffaEAssegna()}
                className="flex-1 border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:border-[#d64b55]"
                placeholder="es. 35.00"
                autoFocus
              />
            </div>
            {tariffaError && <p className="text-xs text-red-500 mb-3 mt-1">{tariffaError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setTariffaMancante(null); setTariffaInput(''); setTariffaError(null) }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-[7px] hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveTariffaEAssegna}
                disabled={savingTariffa || !tariffaInput}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-[7px] transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#d64b55' }}
              >
                {savingTariffa ? 'Salvataggio...' : 'Salva e assegna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
