'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CorsoConOre } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ModalitaIcon } from '@/components/ui/ModalitaIcon'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { formatDate, telHref } from '@/lib/utils'
import { QuestionarioModal, buildQuestionarioUrl } from '@/components/ui/QuestionarioModal'

type CorsoInAttesa = { id: string; title: string }

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

type ReferenteInfo = { id: string; nome: string; email: string; tel?: string } | null
interface CorsoConReferente extends Omit<CorsoConOre, 'referente'> {
  referente?: ReferenteInfo
}

interface ProgettoInfo {
  id: string
  school_name: string
  address?: string
  ref_name: string
  ref_email: string
  ref_tel?: string
  finanziamento_id?: string | null
  regione?: string | null
  provincia?: string | null
}

interface Props {
  progetto: ProgettoInfo
  corsi: CorsoConReferente[]
  finanziamenti: { id: string; nome: string }[]
  formatoreNome: string
}

export function ProgettoFormatoreClient({ progetto, corsi, finanziamenti, formatoreNome }: Props) {
  const router = useRouter()
  const [selectedCorso, setSelectedCorso] = useState<CorsoConReferente | null>(null)
  const [sessioni, setSessioni] = useState<{ id: string; data: string; ore: number; ora_inizio?: string | null; ora_fine?: string | null; created_at: string }[]>([])
  const [loadingSessioni, setLoadingSessioni] = useState(false)
  const [newData, setNewData] = useState('')
  const [newOre, setNewOre] = useState('')
  const [newOraInizio, setNewOraInizio] = useState('')
  const [newOraFine, setNewOraFine] = useState('')
  const [saving, setSaving] = useState(false)

  const [questionarioCorsoId, setQuestionarioCorsoId] = useState<string | null>(null)

  // Accettazione
  const [submittingAccetta, setSubmittingAccetta] = useState<string | null>(null)
  const [rifiutoModalCorso, setRifiutoModalCorso] = useState<CorsoInAttesa | null>(null)
  const [rifiutoMotivazione, setRifiutoMotivazione] = useState('')
  const [submittingRifiuto, setSubmittingRifiuto] = useState(false)
  const [accettazioneError, setAccettazioneError] = useState<string | null>(null)

  const finNome = progetto.finanziamento_id ? finanziamenti.find(f => f.id === progetto.finanziamento_id)?.nome : null
  const color = finNome ? badgeColor(finNome) : null

  // Per il referente: usa il referente specifico del primo corso se presente
  const refCorso = corsi.find(c => c.referente)?.referente
  const refNome = refCorso?.nome || progetto.ref_name
  const refEmail = refCorso?.email || progetto.ref_email
  const refTel = refCorso?.tel || progetto.ref_tel

  const corsiInAttesa = corsi.filter(c => c.stato_assegnazione === 'in_attesa').length

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

  const openModal = async (corso: CorsoConReferente) => {
    setSelectedCorso(corso)
    setLoadingSessioni(true)
    const res = await fetch(`/api/sessioni?corso_id=${corso.id}`)
    setSessioni((await res.json()) || [])
    setLoadingSessioni(false)
  }

  const oreResidue = selectedCorso
    ? Math.max(Number(selectedCorso.ore_totali) - Number(selectedCorso.ore_pianificate), 0)
    : 0

  function calcOreFromTime(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const diffMin = (eh * 60 + em) - (sh * 60 + sm)
    if (diffMin <= 0) return 0
    return Math.round((diffMin / 60) * 2) / 2
  }

  const oreFromTimes = newOraInizio && newOraFine ? calcOreFromTime(newOraInizio, newOraFine) : 0
  const useTimePickers = !!(newOraInizio && newOraFine)
  const effectiveNewOre = useTimePickers ? String(oreFromTimes) : newOre
  const newOreNum = Number(effectiveNewOre)
  const oraFineError = useTimePickers && oreFromTimes <= 0 ? 'Ora fine deve essere successiva all\'ora inizio' : ''
  const oreError = !oraFineError && effectiveNewOre && newOreNum > oreResidue
    ? `Max ${oreResidue}h residue`
    : (!oraFineError && !useTimePickers && newOre && newOreNum <= 0 ? 'Ore non valide' : '')
  const canSubmit = newData && newOreNum > 0 && !oreError && !oraFineError && oreResidue > 0 &&
    (useTimePickers || !!newOre)

  const handleAddSession = async () => {
    if (!selectedCorso) return
    setSaving(true)
    try {
      const res = await fetch('/api/sessioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corso_id: selectedCorso.id,
          data: newData,
          ore: newOreNum,
          ...(newOraInizio && { ora_inizio: newOraInizio }),
          ...(newOraFine && { ora_fine: newOraFine }),
        }),
      })
      if (res.ok) {
        setNewData('')
        setNewOre('')
        setNewOraInizio('')
        setNewOraFine('')
        const updated = await fetch(`/api/sessioni?corso_id=${selectedCorso.id}`)
        setSessioni((await updated.json()) || [])
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
            <div className="text-xs text-amber-600">Scorri in basso per accettare o rifiutare l&apos;incarico</div>
          </div>
        </div>
      )}

      {accettazioneError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {accettazioneError}
        </div>
      )}

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors"
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Indietro
      </button>

      {/* Header progetto */}
      <div className="bg-white rounded-xl px-5 py-5 mb-6" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">{progetto.school_name}</h1>
              {finNome && color && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: color.bg, color: color.text }}
                >
                  {finNome}
                </span>
              )}
            </div>
            {progetto.address && <p className="text-sm text-gray-400">{progetto.address}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-medium text-gray-500">{corsi.length} cors{corsi.length === 1 ? 'o' : 'i'}</div>
          </div>
        </div>

        {/* Referente */}
        <div className="flex items-start gap-2 text-sm bg-gray-50 rounded-[7px] px-4 py-3">
          <svg className="text-gray-400 mt-0.5 shrink-0" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <span className="font-medium text-gray-700">{refNome}</span>
            <span className="text-gray-400 mx-2">·</span>
            <a href={`mailto:${refEmail}`} className="text-blue-600 hover:underline">{refEmail}</a>
            {refTel && (
              <>
                <span className="text-gray-400 mx-2">·</span>
                <a href={`tel:${telHref(refTel)}`} className="text-blue-600 hover:underline">{refTel}</a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Corsi */}
      <div className="space-y-3">
        {corsi.map(corso => {
          const oreTot = Number(corso.ore_totali)
          const orePian = Number(corso.ore_pianificate)
          const oreErog = Number(corso.ore_erogate)
          const oreRes = Math.max(oreTot - orePian, 0)
          const pct = oreTot > 0 ? Math.min(Math.round((orePian / oreTot) * 100), 100) : 0
          const stato = corso.calendario_completo
            ? { label: 'Pianificato', bg: '#dcfce7', text: '#166534' }
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
                        onClick={() => { setRifiutoModalCorso({ id: corso.id, title: corso.title }); setRifiutoMotivazione('') }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[7px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                      >
                        ✗ Rifiuta incarico
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className="font-semibold text-gray-900">{corso.title}</h3>
                    <StatusBadge variant={corso.tipo} size="sm" />
                    <ModalitaIcon modalita={corso.modalita} tipo={corso.tipo} size={14} />
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: stato.bg, color: stato.text }}
                    >
                      {stato.label}
                    </span>
                    {(corso as CorsoConReferente & { corso_completato?: boolean }).corso_completato && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                        <svg width="9" height="9" fill="none" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                        Completato
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{oreTot}h totali</span>
                    <span>{orePian}h pianificate</span>
                    <span className={oreRes > 0 ? 'font-medium text-gray-600' : 'text-gray-400'}>
                      {oreRes}h residue
                    </span>
                    <span className="font-medium text-gray-600">{pct}%</span>
                  </div>
                </div>
                {!inAttesa && (
                  <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                    <Button
                      size="sm"
                      variant={corso.calendario_completo ? 'secondary' : 'primary'}
                      onClick={() => openModal(corso)}
                    >
                      {corso.calendario_completo ? 'Vedi calendario' : 'Pianifica'}
                    </Button>
                    <button
                      onClick={() => setQuestionarioCorsoId(corso.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-[7px] transition-colors"
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                        <path d="M9 12h6M9 16h4M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M9 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Questionario
                    </button>
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
              <DualProgressBar oreTotali={oreTot} orePianificate={orePian} oreErogate={oreErog} size="sm" />
              {corso.link_scheda && (
                <div className="mt-2">
                  <a
                    href={corso.link_scheda}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Scheda corso
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

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

      {/* Calendario modal */}
      <Modal
        open={!!selectedCorso}
        onClose={() => { setSelectedCorso(null); setNewData(''); setNewOre(''); setNewOraInizio(''); setNewOraFine('') }}
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
                <Input label="Data *" type="date" value={newData} onChange={e => setNewData(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ora inizio</label>
                    <input
                      type="time"
                      value={newOraInizio}
                      onChange={e => setNewOraInizio(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ora fine</label>
                    <input
                      type="time"
                      value={newOraFine}
                      onChange={e => setNewOraFine(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors"
                    />
                  </div>
                </div>
                {oraFineError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
                    {oraFineError}
                  </div>
                )}
                {useTimePickers && !oraFineError && (
                  <div className={`text-xs rounded-[7px] px-3 py-2 ${newOreNum > oreResidue ? 'text-red-600 bg-red-50 border border-red-200' : 'text-blue-600 bg-blue-50 border border-blue-200'}`}>
                    Durata calcolata: <span className="font-semibold">{oreFromTimes}h</span>
                    {newOreNum > oreResidue && ` — Max ${oreResidue}h residue`}
                  </div>
                )}
                {!useTimePickers && (
                  <Input
                    label="Ore *"
                    type="number"
                    min={0.5}
                    step={0.5}
                    max={oreResidue}
                    value={newOre}
                    onChange={e => setNewOre(e.target.value)}
                    hint={oreResidue > 0 ? `Max ${oreResidue}h residue` : 'Ore residue esaurite'}
                    error={oreError}
                    placeholder={`Es. ${Math.min(oreResidue, 4)}`}
                  />
                )}
                <Button onClick={handleAddSession} loading={saving} disabled={!canSubmit} size="sm">
                  Aggiungi sessione
                </Button>
              </div>
            )}

            {loadingSessioni ? (
              <div className="text-center py-4 text-sm text-gray-400">Caricamento...</div>
            ) : (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Sessioni pianificate ({sessioni.length})
                </h4>
                {sessioni.length === 0 ? (
                  <div className="text-sm text-gray-400">Nessuna sessione ancora.</div>
                ) : (
                  <div className="space-y-1.5">
                    {sessioni.map(s => (
                      <div key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-[7px] px-3 py-2 text-sm">
                        <span className="font-medium text-gray-800">{formatDate(s.data)}</span>
                        {s.ora_inizio && s.ora_fine && (
                          <span className="text-gray-500">{s.ora_inizio.substring(0, 5)}–{s.ora_fine.substring(0, 5)}</span>
                        )}
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

      {(() => {
        const qCorso = questionarioCorsoId ? corsi.find(c => c.id === questionarioCorsoId) : null
        if (!qCorso) return null
        return (
          <QuestionarioModal
            open={!!questionarioCorsoId}
            onClose={() => setQuestionarioCorsoId(null)}
            url={buildQuestionarioUrl({
              corsoId: qCorso.id,
              scuola: progetto.school_name,
              titoloCorso: qCorso.title,
              formatore: formatoreNome,
              tipoCorso: qCorso.tipo || '',
              regione: progetto.regione || '',
              provincia: progetto.provincia || '',
              lineaFinanziamento: finNome || '',
            })}
            titoloCorso={qCorso.title}
            corsoId={qCorso.id}
            hasFormatore={true}
          />
        )
      })()}
    </div>
  )
}
