'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CorsoConOre, Profile, QuestionarioRisultato } from '@/lib/types'
import { QuestionariMiniCard } from '@/components/ui/QuestionariBlock'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

const BADGE_PALETTE = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#cffafe', text: '#155e75' },
  { bg: '#ffedd5', text: '#9a3412' },
  { bg: '#f0fdf4', text: '#14532d' },
]
function badgeColor(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0x7fffffff
  return BADGE_PALETTE[h % BADGE_PALETTE.length]
}

type ProgettoInfo = {
  id: string; school_name: string; address?: string
  anno_scolastico?: string; ref_name: string; ref_email: string
  ref_tel?: string; finanziamento_id?: string | null
}

type ReferenteInfo = { id: string; nome: string; email: string; tel?: string } | null

interface CorsoConProgetto extends Omit<CorsoConOre, 'referente'> {
  progetti?: ProgettoInfo
  referente?: ReferenteInfo
}

type CorsoDisponibile = {
  id: string
  title: string
  tipo: string
  ore_totali: number
  school_name: string
  candidature_aperte_at: string | null
  già_candidato: boolean
}

interface FormatoreClientProps {
  corsi: CorsoConProgetto[]
  profile: Profile
  finanziamenti: { id: string; nome: string }[]
  questionari?: QuestionarioRisultato[]
  mediaGlobale?: number | null
  corsiDisponibili?: CorsoDisponibile[]
  oreErogate?: number
  oreErogatePerCorso?: Record<string, number>
}

export function FormatoreClient({ corsi, profile, finanziamenti, questionari = [], mediaGlobale = null, corsiDisponibili = [], oreErogate = 0, oreErogatePerCorso = {} }: FormatoreClientProps) {
  const router = useRouter()

  // Calendar modal
  const [selectedCorso, setSelectedCorso] = useState<CorsoConProgetto | null>(null)
  const [sessioni, setSessioni] = useState<{ id: string; data: string; ore: number; created_at: string }[]>([])
  const [loadingSessioni, setLoadingSessioni] = useState(false)
  const [newData, setNewData] = useState('')
  const [newOre, setNewOre] = useState('')
  const [saving, setSaving] = useState(false)

  // Accettazione
  const [submittingAccetta, setSubmittingAccetta] = useState<string | null>(null)
  const [rifiutoModalCorso, setRifiutoModalCorso] = useState<CorsoConProgetto | null>(null)
  const [rifiutoMotivazione, setRifiutoMotivazione] = useState('')
  const [submittingRifiuto, setSubmittingRifiuto] = useState(false)
  const [accettazioneError, setAccettazioneError] = useState<string | null>(null)

  // Candidatura state
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [candidaturaLoading, setCandidaturaLoading] = useState<string | null>(null)
  const [candidaturaInviata, setCandidaturaInviata] = useState<Set<string>>(new Set())
  const [candidaturaError, setCandidaturaError] = useState<Record<string, string>>({})

  const totalOre = corsi.reduce((s, c) => s + Number(c.ore_totali), 0)
  const totalPianificate = corsi.reduce((s, c) => s + Number(c.ore_pianificate), 0)
  const pctGlobale = totalOre > 0 ? Math.round((totalPianificate / totalOre) * 100) : 0
  const corsiInAttesa = corsi.filter(c => c.stato_assegnazione === 'in_attesa').length

  const byProgetto = useMemo(() => {
    const map = new Map<string, { progetto: ProgettoInfo; corsi: CorsoConProgetto[] }>()
    for (const corso of corsi) {
      const pid = corso.project_id
      if (!map.has(pid)) map.set(pid, { progetto: corso.progetti!, corsi: [] })
      map.get(pid)!.corsi.push(corso)
    }
    return [...map.values()]
  }, [corsi])

  const openModal = async (corso: CorsoConProgetto) => {
    setSelectedCorso(corso)
    setLoadingSessioni(true)
    const res = await fetch(`/api/sessioni?corso_id=${corso.id}`)
    setSessioni((await res.json()) || [])
    setLoadingSessioni(false)
  }

  const handleAccetta = async (corsoId: string) => {
    setSubmittingAccetta(corsoId)
    setAccettazioneError(null)
    try {
      const res = await fetch(`/api/corsi/${corsoId}/accetta`, { method: 'POST' })
      if (res.ok) {
        router.refresh()
      } else {
        const j = await res.json()
        setAccettazioneError(j.error || 'Errore durante l\'accettazione')
      }
    } finally {
      setSubmittingAccetta(null)
    }
  }

  const handleRifiuta = async () => {
    if (!rifiutoModalCorso || !rifiutoMotivazione.trim()) return
    setSubmittingRifiuto(true)
    try {
      const res = await fetch(`/api/corsi/${rifiutoModalCorso.id}/rifiuta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivazione: rifiutoMotivazione.trim() }),
      })
      if (res.ok) {
        setRifiutoModalCorso(null)
        setRifiutoMotivazione('')
        router.refresh()
      } else {
        const j = await res.json()
        setAccettazioneError(j.error || 'Errore durante il rifiuto')
      }
    } finally {
      setSubmittingRifiuto(false)
    }
  }

  const oreResidue = selectedCorso ? Math.max(Number(selectedCorso.ore_totali) - Number(selectedCorso.ore_pianificate), 0) : 0
  const newOreNum = Number(newOre)
  const oreError = newOre && newOreNum > oreResidue ? `Max ${oreResidue}h residue` : ''
  const canSubmit = newData && newOre && !oreError && newOreNum > 0 && oreResidue > 0

  const handleAddSession = async () => {
    if (!selectedCorso) return
    setSaving(true)
    try {
      const res = await fetch('/api/sessioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso_id: selectedCorso.id, data: newData, ore: newOreNum }),
      })
      if (res.ok) {
        setNewData('')
        setNewOre('')
        const r2 = await fetch(`/api/sessioni?corso_id=${selectedCorso.id}`)
        setSessioni(await r2.json())
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar nome={profile.nome} id={profile.id} initials={profile.avatar_initials} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ciao, {profile.nome.split(' ')[0]}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
      </div>

      {/* Banner corsi in attesa */}
      {corsiInAttesa > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M12 9v4M12 17h.01" stroke="#92400e" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#92400e" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <div className="font-semibold text-amber-800 text-sm">
              {corsiInAttesa === 1 ? 'Hai 1 corso da accettare' : `Hai ${corsiInAttesa} corsi da accettare`}
            </div>
            <div className="text-xs text-amber-600">Scorri in basso per accettare o rifiutare l'incarico</div>
          </div>
        </div>
      )}

      {accettazioneError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {accettazioneError}
        </div>
      )}

      {/* Corsi disponibili */}
      {corsiDisponibili.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Corsi disponibili — candidati entro 24h
          </h2>
          <div className="space-y-2">
            {corsiDisponibili.map(corso => {
              const giàCandidato = corso.già_candidato || candidaturaInviata.has(corso.id)
              const scadenza = corso.candidature_aperte_at
                ? new Date(new Date(corso.candidature_aperte_at).getTime() + 24 * 60 * 60 * 1000)
                : null
              const oreRimaste = scadenza
                ? Math.max(0, Math.round((scadenza.getTime() - Date.now()) / (1000 * 60 * 60)))
                : null
              return (
                <div key={corso.id} className="bg-white rounded-xl px-5 py-4" style={{ border: '0.5px solid #bfdbfe' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-medium text-gray-900 text-sm">{corso.title}</h3>
                        <StatusBadge variant={corso.tipo as 'PF' | 'Lab'} size="sm" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{corso.school_name}</span>
                        <span>{corso.ore_totali}h</span>
                        {oreRimaste !== null && (
                          <span className={oreRimaste < 4 ? 'text-red-500 font-medium' : 'text-amber-600'}>
                            Scade tra {oreRimaste}h
                          </span>
                        )}
                      </div>
                    </div>
                    {giàCandidato ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1.5 rounded-[7px] shrink-0">
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                        Candidatura inviata
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        loading={candidaturaLoading === corso.id}
                        onClick={async () => {
                          setCandidaturaLoading(corso.id)
                          setCandidaturaError(prev => ({ ...prev, [corso.id]: '' }))
                          try {
                            const res = await fetch(`/api/corsi/${corso.id}/candidature/candidati`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ note: noteMap[corso.id] || '' }),
                            })
                            const j = await res.json()
                            if (!res.ok) {
                              setCandidaturaError(prev => ({ ...prev, [corso.id]: j.error || 'Errore' }))
                              return
                            }
                            setCandidaturaInviata(prev => new Set([...prev, corso.id]))
                          } finally { setCandidaturaLoading(null) }
                        }}
                      >
                        Mi candido
                      </Button>
                    )}
                  </div>
                  {!giàCandidato && (
                    <textarea
                      value={noteMap[corso.id] || ''}
                      onChange={e => setNoteMap(prev => ({ ...prev, [corso.id]: e.target.value }))}
                      placeholder="Note opzionali (motivazione, disponibilità…)"
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none text-gray-700 placeholder-gray-400"
                    />
                  )}
                  {candidaturaError[corso.id] && (
                    <p className="text-xs text-red-500 mt-1">{candidaturaError[corso.id]}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Corsi assegnati" value={corsi.length} />
        <StatCard label="Ore totali" value={`${totalOre}h`} subtitle={`${totalPianificate}h pianificate`} />
        <StatCard label="Ore erogate" value={`${oreErogate}h`} subtitle="sessioni confermate" />
        <StatCard label="Completamento" value={`${pctGlobale}%`} />
      </div>

      {/* Valutazioni */}
      <div className="mb-8">
        <QuestionariMiniCard questionari={questionari} mediaGlobale={mediaGlobale} />
      </div>

      {/* Corsi raggruppati per progetto */}
      {corsi.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="text-sm text-gray-400">Nessun corso assegnato al momento.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {byProgetto.map(({ progetto, corsi: corsiProgetto }) => {
            if (!progetto) return null
            const fin = progetto.finanziamento_id ? finanziamenti.find(f => f.id === progetto.finanziamento_id) : null
            const color = fin ? badgeColor(fin.nome) : null
            return (
              <div key={progetto.id}>
                {/* Header progetto */}
                <div className="bg-white rounded-xl px-5 py-4 mb-2" style={{ border: '0.5px solid #e5e5e5' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h2 className="font-semibold text-gray-900">{progetto.school_name}</h2>
                        {fin && color && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0"
                            style={{ backgroundColor: color.bg, color: color.text }}>
                            {fin.nome}
                          </span>
                        )}
                      </div>
                      {progetto.address && <p className="text-xs text-gray-400">{progetto.address}</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {corsiProgetto.length} cors{corsiProgetto.length === 1 ? 'o' : 'i'}
                    </span>
                  </div>

                  {(() => {
                    const refCorso = corsiProgetto.find(c => c.referente)?.referente
                    const nome = refCorso?.nome || progetto.ref_name
                    const email = refCorso?.email || progetto.ref_email
                    const tel = refCorso?.tel || progetto.ref_tel
                    return (
                      <div className="flex items-start gap-2 text-xs bg-gray-50 rounded-[7px] px-3 py-2">
                        <svg className="text-gray-400 mt-0.5 shrink-0" width="13" height="13" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <div>
                          <span className="font-medium text-gray-700">{nome}</span>
                          <span className="text-gray-400 mx-1">·</span>
                          <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>
                          {tel && <><span className="text-gray-400 mx-1">·</span><span className="text-gray-500">{tel}</span></>}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Corsi del progetto */}
                <div className="space-y-2 pl-3">
                  {corsiProgetto.map(corso => {
                    const orePian = Number(corso.ore_pianificate)
                    const oreTot = Number(corso.ore_totali)
                    const oreEro = oreErogatePerCorso[corso.id] ?? 0
                    const statoCalendario = (oreTot > 0 && oreEro >= oreTot)
                      ? { label: 'Completato', bg: '#dcfce7', text: '#166534' }
                      : orePian === 0
                      ? { label: 'Da pianificare', bg: '#f3f4f6', text: '#6b7280' }
                      : { label: 'In corso', bg: '#dbeafe', text: '#1e40af' }
                    const inAttesa = corso.stato_assegnazione === 'in_attesa'

                    return (
                      <div key={corso.id}
                        className={`bg-white rounded-xl px-5 py-4 ${inAttesa ? 'ring-2 ring-amber-300' : ''}`}
                        style={{ border: '0.5px solid #e5e5e5' }}
                      >
                        {/* Banner accettazione */}
                        {inAttesa && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-3 -mx-1">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div>
                                <div className="font-semibold text-amber-800 text-sm">Nuovo incarico da accettare</div>
                                <div className="text-xs text-amber-600 mt-0.5">Hai 24 ore per rispondere</div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => handleAccetta(corso.id)}
                                  disabled={submittingAccetta === corso.id}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[7px] bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
                                >
                                  {submittingAccetta === corso.id ? '...' : '✓ Accetta incarico'}
                                </button>
                                <button
                                  onClick={() => { setRifiutoModalCorso(corso); setRifiutoMotivazione('') }}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[7px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                                >
                                  ✗ Rifiuta incarico
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-medium text-gray-900 text-sm">{corso.title}</h3>
                              <StatusBadge variant={corso.tipo} size="sm" />
                              <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: statoCalendario.bg, color: statoCalendario.text }}>
                                {statoCalendario.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{oreTot}h totali</span>
                            </div>
                          </div>
                          {!inAttesa && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button size="sm" variant={statoCalendario.label === 'Completato' ? 'secondary' : 'primary'}
                                onClick={() => openModal(corso)}>
                                {statoCalendario.label === 'Completato' ? 'Vedi calendario' : 'Pianifica'}
                              </Button>
                              <button
                                onClick={() => router.push(`/progetti/${corso.project_id}/corsi/${corso.id}`)}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
                              >
                                Vai al corso
                                <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        <DualProgressBar oreTotali={oreTot} orePianificate={orePian} oreErogate={oreEro} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rifiuto modal */}
      <Modal
        open={!!rifiutoModalCorso}
        onClose={() => { setRifiutoModalCorso(null); setRifiutoMotivazione('') }}
        title="Rifiuta incarico"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRifiutoModalCorso(null); setRifiutoMotivazione('') }}>
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={handleRifiuta}
              loading={submittingRifiuto}
              disabled={!rifiutoMotivazione.trim()}
            >
              Conferma rifiuto
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Stai rifiutando il corso <strong>{rifiutoModalCorso?.title}</strong>.
            Il corso verrà rimesso disponibile per essere riassegnato.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Motivazione <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rifiutoMotivazione}
              onChange={e => setRifiutoMotivazione(e.target.value)}
              placeholder="Spiega il motivo del rifiuto..."
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Calendar modal */}
      <Modal
        open={!!selectedCorso}
        onClose={() => { setSelectedCorso(null); setNewData(''); setNewOre('') }}
        title={selectedCorso ? `Calendario — ${selectedCorso.title}` : ''}
        size="lg"
      >
        {selectedCorso && (
          <div className="space-y-5">
            <OreCounter
              oreTotali={Number(selectedCorso.ore_totali)}
              orePianificate={Number(selectedCorso.ore_pianificate)}
            />
            {!selectedCorso.calendario_completo && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Aggiungi sessione</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Data *" type="date" value={newData} onChange={e => setNewData(e.target.value)} />
                  <Input label="Ore *" type="number" min={1} max={oreResidue} value={newOre}
                    onChange={e => setNewOre(e.target.value)}
                    hint={`Max ${oreResidue}h residue`} error={oreError} />
                </div>
                <Button onClick={handleAddSession} loading={saving} disabled={!canSubmit} size="sm">
                  Aggiungi sessione
                </Button>
              </div>
            )}
            {loadingSessioni ? (
              <div className="text-center py-4 text-sm text-gray-400">Caricamento...</div>
            ) : (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Sessioni pianificate ({sessioni.length})</h4>
                {sessioni.length === 0 ? (
                  <div className="text-sm text-gray-400">Nessuna sessione ancora.</div>
                ) : (
                  <div className="space-y-1.5">
                    {sessioni.map(s => (
                      <div key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-[7px] px-3 py-2 text-sm">
                        <span className="font-medium text-gray-800">{formatDate(s.data)}</span>
                        <span className="text-gray-500">{s.ore}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
