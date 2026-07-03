'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CorsoConOre, Sessione, Profile, Progetto, NotaCorso, Referente, QuestionarioRisultato, Candidatura, Tag, Indisponibilita, ModalitaCorso } from '@/lib/types'
import { PROVINCE_TO_REGION, extractProvincia, getRegioneFormatore, getRegioneProgetto } from '@/lib/geo-utils'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate, telHref } from '@/lib/utils'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { RUOLI_REFERENTE } from '@/lib/ruolo-referente'
import { RuoloBadge } from '@/components/ui/RuoloBadge'
import { QuestionariBlock } from '@/components/ui/QuestionariBlock'
import { QuestionarioModal, buildQuestionarioUrl } from '@/components/ui/QuestionarioModal'
import { TagsSection } from '@/components/ui/TagsSection'
import { ModalitaIcon } from '@/components/ui/ModalitaIcon'

interface CorsoDetailClientProps {
  corso: CorsoConOre & { formatore?: Profile; tutor?: Profile; referente?: Referente }
  progetto: Pick<Progetto, 'school_name' | 'anno_scolastico' | 'ref_name' | 'ref_email' | 'ref_tel' | 'finanziamento_id' | 'status'> | null
  finanziamentoNome?: string | null
  sessioni: Sessione[]
  formatori: Profile[]
  tutori: Profile[]
  dualRoleIds?: string[]
  referenti: Referente[]
  note: NotaCorso[]
  questionari: QuestionarioRisultato[]
  candidature?: Candidatura[]
  progettoId: string
  currentUserId: string
  isAdmin: boolean
  canConfirmSessions: boolean
  isSuperAdmin?: boolean
  corsoTags: Tag[]
  allTags: Tag[]
  finanziamentoDataTermine?: string | null
  formatoriSkills?: Record<string, string[]>         // formatore_id → tag_id[]
  formatoriIndisponibilita?: Indisponibilita[]
  tassoAccettazioneMap?: Record<string, number | null>
  oreAssegnateMap?: Record<string, number>
  formatoreAltreSessioni?: Array<{ data: string; ora_inizio: string | null; ora_fine: string | null; corso_title: string }>
  progettoAddress?: string | null
  progettoRegione?: string | null
}

// ── Formatore picker card ─────────────────────────────────────────────────────
function ScoreBadge({ label, active, na }: { label: string; active?: boolean; na?: boolean }) {
  if (na) return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-100">
      {label}
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
      active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
    }`}>
      {active ? (
        <svg width="9" height="9" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
      ) : (
        <svg width="9" height="9" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
      )}
      {label}
    </span>
  )
}

interface FormatorePickerCardProps {
  f: Profile
  score: number
  skillScore: number
  availScore: number
  regionScore: number
  skillMatches: number
  totalCorsoTags: number
  isAvailable: boolean
  sameRegion: boolean | null
  isCurrent: boolean
  isDualRole: boolean
  isAssigning: boolean
  tasso: number | null
  oreAssegnate?: number
  regioneRilevante: boolean
  showScore: boolean
  noTariffa: boolean
  onClick: () => void
}

function FormatorePickerCard({
  f, score, skillMatches, totalCorsoTags, isAvailable, sameRegion,
  isCurrent, isDualRole, isAssigning, tasso, oreAssegnate, regioneRilevante, showScore, noTariffa, onClick,
}: FormatorePickerCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={isAssigning || isCurrent}
      className="w-full flex flex-col gap-2 p-3 rounded-[7px] border text-left transition-all hover:border-[#d64b55] hover:bg-[#fbeced] disabled:cursor-not-allowed"
      style={{
        borderColor: isCurrent ? '#d64b55' : '#e5e5e5',
        backgroundColor: isCurrent ? '#fbeced' : 'white',
        opacity: isAssigning ? 0.6 : 1,
      }}
    >
      {/* Row 1: avatar + name + current/assigning */}
      <div className="flex items-center gap-3">
        <Avatar nome={f.nome} id={f.id} initials={f.avatar_initials} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 flex items-center gap-2 flex-wrap">
            {f.nome}
            {isDualRole && <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Formatore + Tutor</span>}
            {noTariffa && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700"
                title="La tariffa verrà richiesta al momento dell'assegnazione"
              >
                Tariffa mancante
              </span>
            )}
            {oreAssegnate != null && oreAssegnate >= 200 && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700"
                title={`Questo formatore ha già ${oreAssegnate}h assegnate — oltre le 200h consigliate`}
              >
                ⚠️ {oreAssegnate}h assegnate
              </span>
            )}
            {isCurrent && <span className="text-xs text-[#d64b55] font-medium">Corrente</span>}
          </div>
          <div className="text-xs text-gray-400">{f.email}</div>
        </div>
        {isAssigning && (
          <svg className="animate-spin h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {showScore && (
          <div className="shrink-0 text-right">
            <span className="text-sm font-bold" style={{ color: score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626' }}>
              {score}%
            </span>
            <div className="text-xs text-gray-400">match</div>
          </div>
        )}
        {tasso != null && (
          <div className="shrink-0 text-right">
            <span className="text-xs text-gray-500">{tasso}%</span>
            <div className="text-xs text-gray-400">accetta</div>
          </div>
        )}
      </div>

      {/* Row 2: score bar + badges */}
      <div className="flex flex-col gap-1.5 pl-11">
        {showScore && (
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${score}%`,
                backgroundColor: score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626',
              }}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {totalCorsoTags > 0 ? (
            <ScoreBadge
              label={skillMatches > 0 ? `${skillMatches}/${totalCorsoTags} skill` : 'Nessuna skill'}
              active={skillMatches > 0}
            />
          ) : (
            <ScoreBadge label="Nessun tag corso" na />
          )}
          <ScoreBadge label={isAvailable ? 'Disponibile' : 'Conflitti date'} active={isAvailable} />
          {regioneRilevante && sameRegion !== null ? (
            <ScoreBadge label={sameRegion ? 'Stessa regione' : 'Regione diversa'} active={sameRegion} />
          ) : (
            <ScoreBadge label="Regione N/A" na />
          )}
        </div>
      </div>
    </button>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export function CorsoDetailClient({
  corso,
  progetto,
  sessioni: initialSessioni,
  formatori,
  tutori,
  dualRoleIds = [],
  referenti,
  note: initialNote,
  questionari,
  candidature = [],
  progettoId,
  currentUserId,
  isAdmin,
  canConfirmSessions,
  isSuperAdmin,
  finanziamentoNome,
  finanziamentoDataTermine,
  corsoTags,
  allTags,
  formatoriSkills = {},
  formatoriIndisponibilita = [],
  tassoAccettazioneMap = {},
  oreAssegnateMap = {},
  formatoreAltreSessioni = [],
  progettoAddress,
  progettoRegione,
}: CorsoDetailClientProps) {
  const router = useRouter()
  const [sessioni, setSessioni] = useState<Sessione[]>(initialSessioni)
  useEffect(() => { setSessioni(initialSessioni) }, [initialSessioni])
  const [fatturaRicevuta, setFatturaRicevuta] = useState(corso.fattura_ricevuta ?? false)
  const [fatturaRicevutaAt, setFatturaRicevutaAt] = useState<string | null>(corso.fattura_ricevuta_at ?? null)
  const [deleteCorsoOpen, setDeleteCorsoOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formatorePickerOpen, setFormatorePickerOpen] = useState(false)
  const [tutorePickerOpen, setTutorePickerOpen] = useState(false)
  const [referentePickerOpen, setReferentePickerOpen] = useState(false)
  const [newData, setNewData] = useState('')
  const [newOre, setNewOre] = useState('')
  const [newModalitaSessione, setNewModalitaSessione] = useState<'presenza' | 'online'>('presenza')
  const [saving, setSaving] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assigningReferente, setAssigningReferente] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Tariffa mancante modal state
  interface TariffaMancanteInfo {
    tipo: 'formatore' | 'tutor'
    userId: string
    userName: string
    pendingId: string  // formatore_id or tutor_id to assign after saving
  }
  const [tariffaMancante, setTariffaMancante] = useState<TariffaMancanteInfo | null>(null)
  const [tariffaMancanteInput, setTariffaMancanteInput] = useState('')
  const [savingTariffaMancante, setSavingTariffaMancante] = useState(false)
  const [tariffaMancanteError, setTariffaMancanteError] = useState<string | null>(null)

  // Dual-role dialog state
  const [dualRoleUser, setDualRoleUser] = useState<Profile | null>(null)

  // Notes state
  const [note, setNote] = useState<NotaCorso[]>(initialNote)
  useEffect(() => { setNote(initialNote) }, [initialNote])
  const [newNota, setNewNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)
  const [deletingNota, setDeletingNota] = useState<string | null>(null)

  const [questionarioOpen, setQuestionarioOpen] = useState(false)
  const [localQCount, setLocalQCount] = useState(corso.questionario_generato_count ?? 0)
  const [localQAt, setLocalQAt] = useState<string | null>(corso.questionario_generato_at ?? null)

  // Tags state
  const [localCorsoTags, setLocalCorsoTags] = useState<Tag[]>(corsoTags)

  const handleAddCorsoTag = async (tagId: string) => {
    await fetch(`/api/corsi/${corso.id}/tags`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tag_id: tagId }) })
    const tag = allTags.find(t => t.id === tagId)
    if (tag) setLocalCorsoTags(prev => [...prev, tag])
  }
  const handleRemoveCorsoTag = async (tagId: string) => {
    await fetch(`/api/corsi/${corso.id}/tags`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tag_id: tagId }) })
    setLocalCorsoTags(prev => prev.filter(t => t.id !== tagId))
  }
  const handleCreateTag = async (nome: string, colore: string): Promise<Tag> => {
    const res = await fetch('/api/tags', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nome, colore }) })
    if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Errore') }
    return res.json()
  }

  // ── Formatore scoring ────────────────────────────────────────────────────────
  interface FormatoreScore {
    formatore: Profile
    score: number      // 0-100
    skillScore: number // 0-40
    availScore: number // 0-35
    regionScore: number // 0-25
    skillMatches: number
    totalCorsoTags: number
    isAvailable: boolean
    sameRegion: boolean | null  // null = not applicable
  }

  const formatoriScores = useMemo((): FormatoreScore[] => {
    const sessioniDates = sessioni.filter(s => s.data).map(s => s.data.substring(0, 10))
    const schoolRegione = progettoRegione ?? getRegioneProgetto({ regione: progettoRegione, address: progettoAddress })

    return formatori.map(f => {
      // 1. Skill match (40pts)
      const skillTagIds = new Set(formatoriSkills[f.id] || [])
      const totalCorsoTags = localCorsoTags.length
      const skillMatches = localCorsoTags.filter(t => skillTagIds.has(t.id)).length
      const skillScore = totalCorsoTags > 0 ? Math.round((skillMatches / totalCorsoTags) * 40) : 0

      // 2. Availability (35pts)
      const fIndisp = formatoriIndisponibilita.filter(i => i.formatore_id === f.id)
      let availScore = 35
      let isAvailable = true
      if (sessioniDates.length > 0 && fIndisp.length > 0) {
        const indispDates = new Set(fIndisp.map(i => i.data.substring(0, 10)))
        const conflictCount = sessioniDates.filter(d => indispDates.has(d)).length
        availScore = Math.round(((sessioniDates.length - conflictCount) / sessioniDates.length) * 35)
        isAvailable = conflictCount === 0
      }

      // 3. Region (25pts) — applies for corsi in presenza/residenziale/semi-residenziale OR tipo Lab (always on-site)
      const regioneRilevante = corso.modalita === 'presenza' || corso.modalita === 'residenziale' || corso.modalita === 'semi_residenziale' || corso.tipo === 'Lab'
      let regionScore = 25
      let sameRegion: boolean | null = null
      if (regioneRilevante) {
        const fRegione = getRegioneFormatore(f)
        if (schoolRegione && fRegione) {
          sameRegion = schoolRegione === fRegione
          regionScore = sameRegion ? 25 : 0
        }
      }

      return {
        formatore: f,
        score: skillScore + availScore + regionScore,
        skillScore, availScore, regionScore,
        skillMatches, totalCorsoTags,
        isAvailable, sameRegion,
      }
    }).sort((a, b) => b.score - a.score)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatori, localCorsoTags, formatoriSkills, formatoriIndisponibilita, sessioni, progettoAddress, corso.modalita])

  const suggestedScores = formatoriScores.filter(s => s.score > 0)
  const otherScores = formatoriScores.filter(s => s.score === 0)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleOpenQuestionario = () => {
    const nowIso = new Date().toISOString()
    setLocalQCount(c => c + 1)
    setLocalQAt(nowIso)
    setQuestionarioOpen(true)
    fetch(`/api/corsi/${corso.id}/questionario`, { method: 'PATCH' })
      .then(() => router.refresh())
      .catch(() => {})
  }

  // Edit session state
  type LogEntry = {
    id: string; sessione_id: string | null; corso_id: string; utente_id: string
    tipo_modifica: string
    data_precedente?: string | null; data_nuova?: string | null
    ore_precedenti?: number | null; ore_nuove?: number | null
    motivazione_categoria?: string | null; motivazione_dettaglio?: string | null
    created_at: string
    utente?: { id: string; nome: string; role: string; avatar_initials?: string } | null
  }
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<Sessione | null>(null)
  const [editData, setEditData] = useState('')
  const [editOre, setEditOre] = useState('')
  const [editMotivazioneCategoria, setEditMotivazioneCategoria] = useState('')
  const [editMotivazioneDettaglio, setEditMotivazioneDettaglio] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [logModifiche, setLogModifiche] = useState<LogEntry[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [logLoaded, setLogLoaded] = useState(false)

  // Candidature state
  const [candidatureLoading, setCandidatureLoading] = useState<string | null>(null)
  const [candidatureError, setCandidatureError] = useState<string | null>(null)
  const [aperturaLoading, setAperturaLoading] = useState(false)

  // Scheda corso edit state
  const [schedaEditOpen, setSchedaEditOpen] = useState(false)
  const [schedaForm, setSchedaForm] = useState({ link_scheda: corso.link_scheda || '', descrizione: corso.descrizione || '' })
  const [savingScheda, setSavingScheda] = useState(false)

  // Session time pickers (add form)
  const [newOraInizio, setNewOraInizio] = useState('')
  const [newOraFine, setNewOraFine] = useState('')

  // Session time pickers (edit form)
  const [editOraInizio, setEditOraInizio] = useState('')
  const [editOraFine, setEditOraFine] = useState('')

  // Referente corso edit state
  const [referenteCorsoEditOpen, setReferenteCorsoEditOpen] = useState(false)
  const [referenteCorsoForm, setReferenteCorsoForm] = useState({
    referente_corso_nome: corso.referente_corso_nome || '',
    referente_corso_email: corso.referente_corso_email || '',
    referente_corso_telefono: corso.referente_corso_telefono || '',
    referente_corso_ruolo: corso.referente_corso_ruolo || '',
  })
  const [savingReferenteCorso, setSavingReferenteCorso] = useState(false)

  // Calendario state
  const [invioLoading, setInvioLoading] = useState(false)
  const [invioError, setInvioError] = useState<string | null>(null)
  const [confermaLoading, setConfermaLoading] = useState(false)
  const [calendarioConfermatoLocal, setCalendarioConfermatoLocal] = useState(corso.calendario_confermato ?? false)
  const [calendarioInviatoAt, setCalendarioInviatoAt] = useState(corso.calendario_inviato_at ?? null)

  // Completamento corso
  const [completamentoModalOpen, setCompletamentoModalOpen] = useState(false)
  const [adminCompletamentoModalOpen, setAdminCompletamentoModalOpen] = useState(false)
  const [completamentoLoading, setCompletamentoLoading] = useState(false)
  const [completamentoError, setCompletamentoError] = useState<string | null>(null)
  const [corsoCompletatoLocal, setCorsoCompletatoLocal] = useState(corso.corso_completato ?? false)
  const [corsoCompletatoAtLocal, setCorsoCompletatoAtLocal] = useState(corso.corso_completato_at ?? null)

  // Edizione + note corso (admin edit via corsoInfo modal)
  const [edizioneLocal, setEdizioneLocal] = useState(corso.edizione || '')
  const [noteCorsoLocal, setNoteCorsoLocal] = useState(corso.note || '')
  const [corsoInfoEditOpen, setCorsoInfoEditOpen] = useState(false)
  const [corsoInfoForm, setCorsoInfoForm] = useState({ edizione: corso.edizione || '', note: corso.note || '' })
  const [savingCorsoInfo, setSavingCorsoInfo] = useState(false)

  // Modifica corso (admin — titolo, tipo, modalità, ore, edizione, note, location)
  const [corsoEditOpen, setCorsoEditOpen] = useState(false)
  const [corsoEditForm, setCorsoEditForm] = useState({
    title: corso.title,
    tipo: corso.tipo as string,
    modalita: corso.modalita || 'presenza',
    ore_totali: String(corso.ore_totali),
    edizione: corso.edizione || '',
    note: corso.note || '',
    location: corso.location || '',
  })
  const [savingCorsoEdit, setSavingCorsoEdit] = useState(false)

  // Tariffa oraria (admin edit)
  const [tariffaModalOpen, setTariffaModalOpen] = useState(false)
  const [tariffaForm, setTariffaForm] = useState(corso.tariffa_oraria != null ? String(corso.tariffa_oraria) : '')
  const [savingTariffa, setSavingTariffa] = useState(false)

  // Tariffa tutor (admin edit)
  const [tariffaTutorModalOpen, setTariffaTutorModalOpen] = useState(false)
  const [tariffaTutorForm, setTariffaTutorForm] = useState(corso.tariffa_oraria_tutor != null ? String(corso.tariffa_oraria_tutor) : '')
  const [savingTariffaTutor, setSavingTariffaTutor] = useState(false)

  // Lettera d'incarico — formatore
  const [letteraUrl, setLetteraUrl] = useState<string | null>(corso.lettera_incarico_url ?? null)
  const [letteraFirmata, setLetteraFirmata] = useState(corso.lettera_incarico_firmata ?? false)
  const [letteraFirmataAt, setLetteraFirmataAt] = useState<string | null>(corso.lettera_incarico_firmata_at ?? null)
  const [letteraPending, setLetteraPending] = useState(corso.lettera_incarico_pending ?? false)
  const [generandoLettera, setGenerandoLettera] = useState(false)
  const [generandoLetteraError, setGenerandoLetteraError] = useState<string | null>(null)
  const [firmaLetteraOpen, setFirmaLetteraOpen] = useState(false)
  const [firmandoLettera, setFirmandoLettera] = useState(false)
  const [firmaLetteraError, setFirmaLetteraError] = useState<string | null>(null)
  const [rigeneraLetteraOpen, setRigeneraLetteraOpen] = useState(false)
  const [annullaLetteraOpen, setAnnullaLetteraOpen] = useState(false)
  const [annullaLetteraMotivo, setAnnullaLetteraMotivo] = useState('')
  const [annullandoLettera, setAnnullandoLettera] = useState(false)
  const [annullaLetteraError, setAnnullaLetteraError] = useState<string | null>(null)

  // Lettera d'incarico — tutor
  const [letteraTutorUrl, setLetteraTutorUrl] = useState<string | null>(corso.lettera_tutor_url ?? null)
  const [letteraTutorFirmata, setLetteraTutorFirmata] = useState(corso.lettera_tutor_firmata ?? false)
  const [letteraTutorFirmataAt, setLetteraTutorFirmataAt] = useState<string | null>(corso.lettera_tutor_firmata_at ?? null)
  const [letteraTutorPending, setLetteraTutorPending] = useState(corso.lettera_tutor_pending ?? false)
  const [generandoLetteraTutor, setGenerandoLetteraTutor] = useState(false)
  const [generandoLetteraTutorError, setGenerandoLetteraTutorError] = useState<string | null>(null)
  const [firmaLetteraTutorOpen, setFirmaLetteraTutorOpen] = useState(false)
  const [firmandoLetteraTutor, setFirmandoLetteraTutor] = useState(false)
  const [firmaLetteraTutorError, setFirmaLetteraTutorError] = useState<string | null>(null)
  const [rigeneraLetteraTutorOpen, setRigeneraLetteraTutorOpen] = useState(false)
  const [annullaLetteraTutorOpen, setAnnullaLetteraTutorOpen] = useState(false)
  const [annullaLetteraTutorMotivo, setAnnullaLetteraTutorMotivo] = useState('')
  const [annullandoLetteraTutor, setAnnullandoLetteraTutor] = useState(false)
  const [annullaLetteraTutorError, setAnnullaLetteraTutorError] = useState<string | null>(null)

  // Time-to-ore helper (round to nearest 0.5h)
  const calcOreFromTime = (start: string, end: string): number => {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const diffMin = (eh * 60 + em) - (sh * 60 + sm)
    if (diffMin <= 0) return 0
    return Math.round((diffMin / 60) * 2) / 2
  }

  const isIbrido = corso.tipo === 'PF' && corso.modalita === 'ibrido'

  const orePianificate = Number(corso.ore_pianificate)
  const oreResidue = Math.max(Number(corso.ore_totali) - orePianificate, 0)
  // Derive ore from time pickers if both set, otherwise use manual field
  const oreFromTimes = newOraInizio && newOraFine ? calcOreFromTime(newOraInizio, newOraFine) : 0
  const effectiveNewOre = newOraInizio && newOraFine ? String(oreFromTimes) : newOre
  const newOreNum = Number(effectiveNewOre)
  const oreError = effectiveNewOre && newOreNum > oreResidue ? `Max ${oreResidue}h residue` : (effectiveNewOre && newOreNum <= 0 ? 'Orario non valido' : '')
  const canSubmitSession = newData && newOreNum > 0 && !oreError && oreResidue > 0 &&
    (!isIbrido || !!newModalitaSessione)

  const handleAddSession = async () => {
    setSessionError(null)

    // ── Client-side: data_termine check ─────────────────────────────────────────
    if (finanziamentoDataTermine && newData > finanziamentoDataTermine) {
      const dataFmt = new Date(finanziamentoDataTermine + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      setSessionError(`Non è possibile inserire sessioni oltre la data di termine prevista per il finanziamento ${finanziamentoNome ?? ''} (${dataFmt}).`)
      return
    }

    // ── Client-side: time overlap check ─────────────────────────────────────────
    if (newOraInizio && newOraFine && formatoreAltreSessioni.length > 0) {
      const sessStessoGiorno = formatoreAltreSessioni.filter(s => s.data === newData && s.ora_inizio && s.ora_fine)
      for (const s of sessStessoGiorno) {
        const exStart = (s.ora_inizio as string).substring(0, 5)
        const exEnd = (s.ora_fine as string).substring(0, 5)
        if (newOraInizio < exEnd && newOraFine > exStart) {
          setSessionError(`Il formatore ha già una sessione in questo slot per il corso "${s.corso_title}" (${exStart}–${exEnd}).`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/sessioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corso_id: corso.id,
          data: newData,
          ore: newOreNum,
          ...(newOraInizio && { ora_inizio: newOraInizio }),
          ...(newOraFine && { ora_fine: newOraFine }),
          ...(isIbrido && { modalita_sessione: newModalitaSessione }),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSessioni(prev => [...prev, data].sort((a, b) => a.data.localeCompare(b.data)))
        setCalendarOpen(false)
        setNewData('')
        setNewOre('')
        setNewOraInizio('')
        setNewOraFine('')
        setNewModalitaSessione('presenza')
        setSessionError(null)
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        setSessionError(json.error || 'Errore durante il salvataggio della sessione.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSession = async (sessioneId: string) => {
    setDeletingId(sessioneId)
    try {
      await fetch(`/api/sessioni/${sessioneId}`, { method: 'DELETE' })
      setSessioni(prev => prev.filter(s => s.id !== sessioneId))
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const doAssignFormatore = async (formatoreId: string) => {
    setAssigningId(formatoreId)
    setAssignError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/formatore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formatore_id: formatoreId }),
      })
      if (res.ok) {
        setFormatorePickerOpen(false)
        router.refresh()
      } else {
        const j = await res.json().catch(() => ({}))
        if (j.error === 'TARIFFA_MANCANTE') {
          setFormatorePickerOpen(false)
          setTariffaMancante({ tipo: 'formatore', userId: j.formatore_id, userName: j.formatore_nome, pendingId: formatoreId })
          setTariffaMancanteInput('')
          setTariffaMancanteError(null)
        } else {
          setAssignError(j.error || 'Errore durante l\'assegnazione')
        }
      }
    } finally {
      setAssigningId(null)
    }
  }

  const handleAssignFormatore = (f: Profile) => {
    if (dualRoleIds.includes(f.id)) {
      // User has both formatore + tutor roles — ask which role to assign
      setDualRoleUser(f)
      setFormatorePickerOpen(false)
    } else {
      doAssignFormatore(f.id)
    }
  }

  const handleRemoveFormatore = async () => {
    await fetch(`/api/corsi/${corso.id}/formatore`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formatore_id: null }),
    })
    router.refresh()
  }

  const handleAssignTutor = async (tutorId: string) => {
    setAssigningId('tutor-' + tutorId)
    setAssignError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/tutor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutor_id: tutorId }),
      })
      if (res.ok) {
        setTutorePickerOpen(false)
        setDualRoleUser(null)
        router.refresh()
      } else {
        const j = await res.json().catch(() => ({}))
        if (j.error === 'TARIFFA_MANCANTE') {
          setTutorePickerOpen(false)
          setDualRoleUser(null)
          setTariffaMancante({ tipo: 'tutor', userId: j.tutor_id, userName: j.tutor_nome, pendingId: tutorId })
          setTariffaMancanteInput('')
          setTariffaMancanteError(null)
        } else {
          setAssignError(j.error || 'Errore durante l\'assegnazione')
        }
      }
    } finally {
      setAssigningId(null)
    }
  }

  const handleRemoveTutor = async () => {
    await fetch(`/api/corsi/${corso.id}/tutor`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutor_id: null }),
    })
    router.refresh()
  }

  const handleSaveTariffaEAssegna = async () => {
    if (!tariffaMancante) return
    const val = parseFloat(tariffaMancanteInput.replace(',', '.'))
    if (!val || val <= 0) { setTariffaMancanteError('Inserisci una tariffa valida maggiore di zero'); return }
    setSavingTariffaMancante(true)
    setTariffaMancanteError(null)
    try {
      // Step 1: salva tariffa nel profilo
      const tariffaKey = tariffaMancante.tipo === 'formatore' ? 'tariffa_oraria_formatore' : 'tariffa_oraria_tutor'
      const patchRes = await fetch(`/api/utenti/${tariffaMancante.userId}/tariffa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [tariffaKey]: val }),
      })
      if (!patchRes.ok) {
        const j = await patchRes.json().catch(() => ({}))
        setTariffaMancanteError(j.error || 'Errore nel salvataggio della tariffa')
        return
      }
      // Step 2: riprova assegnazione
      const endpoint = tariffaMancante.tipo === 'formatore'
        ? `/api/corsi/${corso.id}/formatore`
        : `/api/corsi/${corso.id}/tutor`
      const body = tariffaMancante.tipo === 'formatore'
        ? { formatore_id: tariffaMancante.pendingId }
        : { tutor_id: tariffaMancante.pendingId }
      const assignRes = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!assignRes.ok) {
        const j = await assignRes.json().catch(() => ({}))
        setTariffaMancanteError(j.message || j.error || 'Errore durante l\'assegnazione')
        return
      }
      setTariffaMancante(null)
      router.refresh()
    } finally {
      setSavingTariffaMancante(false)
    }
  }

  const handleAssignReferente = async (referenteId: string | null) => {
    setAssigningReferente(true)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/referente`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referente_id: referenteId }),
      })
      if (res.ok) {
        setReferentePickerOpen(false)
        router.refresh()
      }
    } finally {
      setAssigningReferente(false)
    }
  }

  const handleAddNota = async () => {
    if (!newNota.trim()) return
    setSavingNota(true)
    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso_id: corso.id, testo: newNota.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setNote(prev => [...prev, data])
        setNewNota('')
        router.refresh()
      }
    } finally {
      setSavingNota(false)
    }
  }

  const handleDeleteNota = async (notaId: string) => {
    setDeletingNota(notaId)
    try {
      await fetch(`/api/note/${notaId}`, { method: 'DELETE' })
      setNote(prev => prev.filter(n => n.id !== notaId))
      router.refresh()
    } finally {
      setDeletingNota(null)
    }
  }

  const handleSaveScheda = async () => {
    setSavingScheda(true)
    try {
      const res = await fetch(`/api/corsi/${corso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_scheda: schedaForm.link_scheda.trim() || null,
          descrizione: schedaForm.descrizione.trim() || null,
        }),
      })
      if (res.ok) {
        setSchedaEditOpen(false)
        router.refresh()
      }
    } finally {
      setSavingScheda(false)
    }
  }

  const openEditModal = (s: Sessione) => {
    setEditingSession(s)
    setEditData(s.data)
    setEditOre(String(s.ore))
    setEditOraInizio(s.ora_inizio ? s.ora_inizio.substring(0, 5) : '')
    setEditOraFine(s.ora_fine ? s.ora_fine.substring(0, 5) : '')
    setEditMotivazioneCategoria('')
    setEditMotivazioneDettaglio('')
    setEditError(null)
    setEditModalOpen(true)
  }

  const handleEditSession = async () => {
    if (!editingSession || !editMotivazioneCategoria) return
    setSavingEdit(true)
    setEditError(null)
    // Derive ore from times if both set
    const oreFromEditTimes = editOraInizio && editOraFine ? calcOreFromTime(editOraInizio, editOraFine) : 0
    const finalEditOre = editOraInizio && editOraFine ? oreFromEditTimes : Number(editOre)
    try {
      const res = await fetch(`/api/sessioni/${editingSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: editData,
          ore: finalEditOre,
          ...(editOraInizio ? { ora_inizio: editOraInizio } : {}),
          ...(editOraFine ? { ora_fine: editOraFine } : {}),
          motivazione_categoria: editMotivazioneCategoria,
          motivazione_dettaglio: editMotivazioneDettaglio.trim() || undefined,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSessioni(prev => prev.map(s => s.id === editingSession.id ? { ...s, data: updated.data, ore: updated.ore } : s).sort((a, b) => a.data.localeCompare(b.data)))
        setEditModalOpen(false)
        setEditingSession(null)
        if (logLoaded) fetchLog()
        router.refresh()
      } else {
        const j = await res.json()
        setEditError(j.error || 'Errore durante la modifica')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const fetchLog = async () => {
    setLoadingLog(true)
    try {
      const res = await fetch(`/api/sessioni-log?corso_id=${corso.id}`)
      if (res.ok) {
        setLogModifiche(await res.json())
        setLogLoaded(true)
      }
    } finally {
      setLoadingLog(false)
    }
  }

  const handleConfirmSession = async (sessioneId: string) => {
    setConfirmingId(sessioneId)
    try {
      const res = await fetch(`/api/sessioni/${sessioneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completata: true }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSessioni(prev => prev.map(s => s.id === sessioneId ? { ...s, completata: true, completata_at: updated.completata_at } : s))
        router.refresh()
      }
    } finally {
      setConfirmingId(null)
    }
  }

  const handleSaveReferenteCorso = async () => {
    setSavingReferenteCorso(true)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/referente-corso`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(referenteCorsoForm),
      })
      if (res.ok) {
        setReferenteCorsoEditOpen(false)
        router.refresh()
      }
    } finally {
      setSavingReferenteCorso(false)
    }
  }

  const handleInvioCalendario = async () => {
    setInvioLoading(true)
    setInvioError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/invio-calendario`, { method: 'POST' })
      if (res.ok) {
        setCalendarioInviatoAt(new Date().toISOString())
        router.refresh()
      } else {
        const j = await res.json().catch(() => ({}))
        setInvioError(j.error || 'Errore durante l\'invio')
      }
    } finally {
      setInvioLoading(false)
    }
  }

  const handleConfermaCalendario = async (confermato: boolean) => {
    setConfermaLoading(true)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/conferma-calendario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confermato }),
      })
      if (res.ok) {
        setCalendarioConfermatoLocal(confermato)
        router.refresh()
      }
    } finally {
      setConfermaLoading(false)
    }
  }

  const handleCompletaCorso = async () => {
    setCompletamentoLoading(true)
    setCompletamentoError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/completamento`, { method: 'POST' })
      if (res.ok) {
        setCorsoCompletatoLocal(true)
        setCorsoCompletatoAtLocal(new Date().toISOString())
        setCompletamentoModalOpen(false)
        router.refresh()
      } else {
        const j = await res.json().catch(() => ({}))
        setCompletamentoError(j.error || 'Errore durante il completamento')
      }
    } finally {
      setCompletamentoLoading(false)
    }
  }

  const handleAdminCompletaCorso = async () => {
    setCompletamentoLoading(true)
    setCompletamentoError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/completamento`, { method: 'POST' })
      if (res.ok) {
        setCorsoCompletatoLocal(true)
        setCorsoCompletatoAtLocal(new Date().toISOString())
        setAdminCompletamentoModalOpen(false)
        router.refresh()
      } else {
        const j = await res.json().catch(() => ({}))
        setCompletamentoError(j.error || 'Errore durante il completamento')
      }
    } finally {
      setCompletamentoLoading(false)
    }
  }

  const handleGeneraLettera = async () => {
    setGenerandoLettera(true)
    setGenerandoLetteraError(null)
    setRigeneraLetteraOpen(false)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/lettera-incarico`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setLetteraUrl(d.lettera_incarico_url)
        setLetteraFirmata(false)
        setLetteraFirmataAt(null)
        setLetteraPending(true)
      } else {
        const j = await res.json().catch(() => ({}))
        setGenerandoLetteraError(j.error || 'Errore durante la generazione')
      }
    } finally {
      setGenerandoLettera(false)
    }
  }

  const handleGeneraLetteraTutor = async () => {
    setGenerandoLetteraTutor(true)
    setGenerandoLetteraTutorError(null)
    setRigeneraLetteraTutorOpen(false)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/lettera-tutor`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setLetteraTutorUrl(d.lettera_tutor_url)
        setLetteraTutorFirmata(false)
        setLetteraTutorFirmataAt(null)
        setLetteraTutorPending(true)
      } else {
        const j = await res.json().catch(() => ({}))
        setGenerandoLetteraTutorError(j.error || 'Errore durante la generazione')
      }
    } finally {
      setGenerandoLetteraTutor(false)
    }
  }

  const handleAnnullaLettera = async () => {
    setAnnullandoLettera(true)
    setAnnullaLetteraError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/annulla-lettera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: annullaLetteraMotivo.trim() || null }),
      })
      if (res.ok) {
        setLetteraUrl(null)
        setLetteraFirmata(false)
        setLetteraFirmataAt(null)
        setLetteraPending(false)
        setAnnullaLetteraOpen(false)
        setAnnullaLetteraMotivo('')
      } else {
        const j = await res.json().catch(() => ({}))
        setAnnullaLetteraError(j.error || 'Errore durante l\'annullamento')
      }
    } finally {
      setAnnullandoLettera(false)
    }
  }

  const handleAnnullaLetteraTutor = async () => {
    setAnnullandoLetteraTutor(true)
    setAnnullaLetteraTutorError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/annulla-lettera-tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: annullaLetteraTutorMotivo.trim() || null }),
      })
      if (res.ok) {
        setLetteraTutorUrl(null)
        setLetteraTutorFirmata(false)
        setLetteraTutorFirmataAt(null)
        setLetteraTutorPending(false)
        setAnnullaLetteraTutorOpen(false)
        setAnnullaLetteraTutorMotivo('')
      } else {
        const j = await res.json().catch(() => ({}))
        setAnnullaLetteraTutorError(j.error || 'Errore durante l\'annullamento')
      }
    } finally {
      setAnnullandoLetteraTutor(false)
    }
  }

  const handleFirmaLettera = async () => {
    setFirmandoLettera(true)
    setFirmaLetteraError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/firma-lettera`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setLetteraFirmata(true)
        setLetteraFirmataAt(d.lettera_incarico_firmata_at)
        setFirmaLetteraOpen(false)
      } else {
        const j = await res.json().catch(() => ({}))
        setFirmaLetteraError(j.error || 'Errore durante la firma')
      }
    } finally {
      setFirmandoLettera(false)
    }
  }

  const handleFirmaLetteraTutor = async () => {
    setFirmandoLetteraTutor(true)
    setFirmaLetteraTutorError(null)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/firma-lettera-tutor`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setLetteraTutorFirmata(true)
        setLetteraTutorFirmataAt(d.lettera_tutor_firmata_at)
        setFirmaLetteraTutorOpen(false)
      } else {
        const j = await res.json().catch(() => ({}))
        setFirmaLetteraTutorError(j.error || 'Errore durante la firma')
      }
    } finally {
      setFirmandoLetteraTutor(false)
    }
  }

  const handleSaveTariffa = async () => {
    setSavingTariffa(true)
    try {
      const res = await fetch(`/api/corsi/${corso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tariffa_oraria: tariffaForm.trim() ? Number(tariffaForm) : null }),
      })
      if (res.ok) {
        setTariffaModalOpen(false)
        router.refresh()
      }
    } finally {
      setSavingTariffa(false)
    }
  }

  const handleSaveTariffaTutor = async () => {
    setSavingTariffaTutor(true)
    try {
      const res = await fetch(`/api/corsi/${corso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tariffa_oraria_tutor: tariffaTutorForm.trim() ? Number(tariffaTutorForm) : null }),
      })
      if (res.ok) {
        setTariffaTutorModalOpen(false)
        router.refresh()
      }
    } finally {
      setSavingTariffaTutor(false)
    }
  }

  const handleSaveCorsoInfo = async () => {
    setSavingCorsoInfo(true)
    try {
      const res = await fetch(`/api/corsi/${corso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edizione: corsoInfoForm.edizione.trim() || null,
          note: corsoInfoForm.note.trim() || null,
        }),
      })
      if (res.ok) {
        setEdizioneLocal(corsoInfoForm.edizione.trim())
        setNoteCorsoLocal(corsoInfoForm.note.trim())
        setCorsoInfoEditOpen(false)
        router.refresh()
      }
    } finally {
      setSavingCorsoInfo(false)
    }
  }

  const handleSaveCorsoEdit = async () => {
    setSavingCorsoEdit(true)
    try {
      const isResidenziale = ['residenziale', 'semi_residenziale'].includes(corsoEditForm.modalita)
      const res = await fetch(`/api/corsi/${corso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: corsoEditForm.title.trim(),
          tipo: corsoEditForm.tipo,
          modalita: corsoEditForm.modalita || null,
          ore_totali: Number(corsoEditForm.ore_totali),
          edizione: corsoEditForm.edizione.trim() || null,
          note: corsoEditForm.note.trim() || null,
          location: isResidenziale ? (corsoEditForm.location.trim() || null) : null,
        }),
      })
      if (res.ok) {
        setEdizioneLocal(corsoEditForm.edizione.trim())
        setNoteCorsoLocal(corsoEditForm.note.trim())
        setCorsoEditOpen(false)
        router.refresh()
      }
    } finally {
      setSavingCorsoEdit(false)
    }
  }

  // Sessions stats for the counter
  const today = new Date().toISOString().split('T')[0]
  const sessioniCompletate = sessioni.filter(s => s.completata).length
  const sessioniScadute = sessioni.filter(s => !s.completata && s.data <= today).length
  const oreErogate = sessioni.filter(s => s.completata).reduce((sum, s) => sum + Number(s.ore), 0)

  // Ore tutor (proporzionale al completamento delle sessioni)
  const oreTutoraggio = Number(corso.ore_tutoraggio || 0)
  const oreTotaliNum = Number(corso.ore_totali)
  const oreTutorPianificate = oreTotaliNum > 0 && oreTutoraggio > 0
    ? Math.round(oreTutoraggio * (orePianificate / oreTotaliNum))
    : 0
  const oreTutorErogate = oreTotaliNum > 0 && oreTutoraggio > 0
    ? Math.round(oreTutoraggio * (oreErogate / oreTotaliNum))
    : 0
  const pctTutor = oreTutoraggio > 0 ? Math.round((oreTutorErogate / oreTutoraggio) * 100) : 0

  const canMarkComplete = !isAdmin && corso.formatore_id === currentUserId && !corsoCompletatoLocal && oreErogate >= Number(corso.ore_totali) && Number(corso.ore_totali) > 0
  const canAdminMarkComplete = isAdmin && !corsoCompletatoLocal && oreErogate >= Number(corso.ore_totali) && Number(corso.ore_totali) > 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {!isAdmin && (
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Indietro
        </button>
      )}
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
        <Link href="/progetti" className="hover:text-gray-700">Progetti</Link>
        <span>/</span>
        <Link href={`/progetti/${progettoId}`} className="hover:text-gray-700">{progetto?.school_name || 'Progetto'}</Link>
        <span>/</span>
        <span className="text-gray-700">{corso.title}</span>
      </div>

      {/* Course header */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{corso.title}</h1>
            <StatusBadge variant={corso.tipo} />
            {edizioneLocal && (
              <span className="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md">
                Edizione: {edizioneLocal}
              </span>
            )}
            {corso.calendario_completo && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-md font-medium">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Calendario completo
              </span>
            )}
            {calendarioConfermatoLocal ? (
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md font-medium">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Confermato scuola
              </span>
            ) : calendarioInviatoAt ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md font-medium">
                In attesa conferma
              </span>
            ) : null}
            {corsoCompletatoLocal && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md font-medium">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Completato dal formatore
                {corsoCompletatoAtLocal && (
                  <span className="font-normal ml-1">
                    il {new Date(corsoCompletatoAtLocal).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </span>
            )}
            {isAdmin && (
              localQCount > 0 ? (
                <div className="flex flex-col gap-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-md font-medium">
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                    Questionario generato
                  </span>
                  <span style={{ fontSize: '11px' }} className="text-gray-400 pl-0.5">
                    Ultima: {localQAt ? new Date(localQAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'} · {localQCount}×
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md font-medium">
                  Questionario non generato
                </span>
              )
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => {
                  setCorsoEditForm({
                    title: corso.title,
                    tipo: corso.tipo,
                    modalita: corso.modalita || 'presenza',
                    ore_totali: String(corso.ore_totali),
                    edizione: edizioneLocal,
                    note: noteCorsoLocal,
                    location: corso.location || '',
                  })
                  setCorsoEditOpen(true)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-[7px] transition-colors"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Modifica corso
              </button>
            )}
            <button
              onClick={handleOpenQuestionario}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-[7px] transition-colors"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <path d="M9 12h6M9 16h4M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M9 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Questionario
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setDeleteCorsoOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-[7px] transition-colors"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Elimina corso
              </button>
            )}
          </div>
        </div>
        {(corso.tipo === 'Lab' || corso.modalita) && (
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ModalitaIcon modalita={corso.modalita} tipo={corso.tipo} size={18} />
              {corso.location && (
                <span className="text-xs text-gray-500">📍 {corso.location}</span>
              )}
            </div>
            {corso.tutor_previsto && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-700">
                👤 Tutor: {corso.tutor_nome || 'Da definire'}
                {corso.ore_tutoraggio ? ` · ${corso.ore_tutoraggio}h` : ''}
              </span>
            )}
          </div>
        )}
        <OreCounter
          oreTotali={Number(corso.ore_totali)}
          orePianificate={orePianificate}
          oreErogate={oreErogate}
          sessioniCompletate={sessioniCompletate}
          sessioniTotali={sessioni.length}
        />
      </div>

      {/* Tags */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <TagsSection
          tags={localCorsoTags}
          allTags={allTags}
          isAdmin={isAdmin}
          onAddTag={handleAddCorsoTag}
          onRemoveTag={handleRemoveCorsoTag}
          onCreateTag={handleCreateTag}
          label="Tag"
        />
      </div>

      {/* Formatore */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Formatore assegnato</h2>
          {corso.stato_assegnazione && corso.stato_assegnazione !== 'non_assegnato' && (() => {
            const badges: Record<string, { label: string; className: string }> = {
              in_attesa: { label: 'In attesa di accettazione', className: 'bg-amber-100 text-amber-800' },
              accettato:  { label: 'Accettato',               className: 'bg-green-100 text-green-800' },
              rifiutato:  { label: 'Rifiutato',               className: 'bg-red-100 text-red-700' },
            }
            const b = badges[corso.stato_assegnazione]
            return b ? (
              <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${b.className}`}>
                {b.label}
              </span>
            ) : null
          })()}
        </div>
        {isAdmin && progetto?.status === 'pending' && corso.formatore_id && (
          <div className="mb-4 flex items-center justify-between p-3 bg-purple-50 border border-purple-100 rounded-[7px]">
            <div>
              <div className="text-sm font-medium text-purple-900">Pre-assegnazione</div>
              <div className="text-xs text-purple-600 mt-0.5">
                {corso.pre_assegnazione
                  ? 'Questa è una pre-assegnazione. Diventerà definitiva quando il progetto passa ad Attivo.'
                  : 'Assegnazione definitiva.'}
              </div>
            </div>
            <button
              onClick={async () => {
                await fetch(`/api/corsi/${corso.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pre_assegnazione: !corso.pre_assegnazione }),
                })
                router.refresh()
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-[6px] border transition-colors ${
                corso.pre_assegnazione
                  ? 'bg-white text-purple-700 border-purple-200 hover:bg-purple-100'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {corso.pre_assegnazione ? 'Segna come definitiva' : 'Segna come pre-assegnazione'}
            </button>
          </div>
        )}
        {corso.stato_assegnazione === 'rifiutato' && corso.rifiuto_motivazione && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-[7px] px-4 py-3 text-sm text-red-700">
            <div className="font-medium mb-0.5">Motivazione rifiuto</div>
            <div>{corso.rifiuto_motivazione}</div>
          </div>
        )}
        {corso.formatore ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar nome={corso.formatore.nome} id={corso.formatore.id} initials={corso.formatore.avatar_initials} size="lg" />
              <div>
                <div className="font-medium text-gray-900">{corso.formatore.nome}</div>
                <a href={`mailto:${corso.formatore.email}`} className="text-sm text-blue-600 hover:underline">{corso.formatore.email}</a>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setFormatorePickerOpen(true)}>Cambia</Button>
                <Button variant="danger" size="sm" onClick={handleRemoveFormatore}>Rimuovi</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Nessun formatore assegnato a questo corso.</p>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => setFormatorePickerOpen(true)}>Assegna Formatore</Button>
                {corso.candidature_aperte ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Candidature aperte ({candidature.length})
                    </span>
                    <button
                      onClick={async () => {
                        setAperturaLoading(true)
                        try {
                          await fetch(`/api/corsi/${corso.id}/candidature/chiudi`, { method: 'POST' })
                          router.refresh()
                        } finally { setAperturaLoading(false) }
                      }}
                      disabled={aperturaLoading}
                      className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors disabled:opacity-50"
                    >
                      {aperturaLoading ? '...' : 'Chiudi candidature'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      setAperturaLoading(true)
                      setCandidatureError(null)
                      try {
                        const res = await fetch(`/api/corsi/${corso.id}/candidature/apri`, { method: 'POST' })
                        if (!res.ok) { const j = await res.json(); setCandidatureError(j.error || 'Errore'); return }
                        router.refresh()
                      } finally { setAperturaLoading(false) }
                    }}
                    disabled={aperturaLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-[7px] transition-colors disabled:opacity-50"
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {aperturaLoading ? '...' : 'Richiedi candidature'}
                  </button>
                )}
              </div>
            )}
            {candidatureError && <p className="text-xs text-red-500">{candidatureError}</p>}
          </div>
        )}
      </div>

      {/* Candidature ricevute */}
      {isAdmin && (candidature.length > 0 || corso.candidature_aperte) && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">
            Candidature ricevute
            {candidature.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({candidature.length})</span>
            )}
          </h2>
          {candidature.length === 0 ? (
            <p className="text-sm text-gray-400">Nessuna candidatura ancora ricevuta.</p>
          ) : (
            <div className="space-y-3">
              {candidature.map(c => {
                const f = c.formatore
                if (!f) return null
                const isSelected = c.stato === 'selezionato'
                const isRejected = c.stato === 'non_selezionato'
                return (
                  <div key={c.id} className={`flex items-start justify-between gap-3 p-3 rounded-[9px] ${isSelected ? 'bg-green-50 border border-green-200' : isRejected ? 'bg-gray-50 border border-gray-200 opacity-60' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar nome={f.nome} id={f.id} initials={f.avatar_initials} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{f.nome}</span>
                          {isSelected && (
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-md">Selezionato</span>
                          )}
                          {isRejected && (
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">Non selezionato</span>
                          )}
                        </div>
                        <a href={`mailto:${f.email}`} className="text-xs text-blue-600 hover:underline">{f.email}</a>
                        {c.note && <p className="text-xs text-gray-500 mt-1">{c.note}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(c.created_at).toLocaleDateString('it-IT')}</p>
                      </div>
                    </div>
                    {c.stato === 'in_attesa' && !corso.formatore_id && (
                      <Button
                        size="sm"
                        loading={candidatureLoading === c.id}
                        onClick={async () => {
                          setCandidatureLoading(c.id)
                          setCandidatureError(null)
                          try {
                            const res = await fetch(`/api/corsi/${corso.id}/candidature/seleziona`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ formatore_id: c.formatore_id }),
                            })
                            if (!res.ok) { const j = await res.json(); setCandidatureError(j.error || 'Errore'); return }
                            router.refresh()
                          } finally { setCandidatureLoading(null) }
                        }}
                      >
                        Seleziona
                      </Button>
                    )}
                  </div>
                )
              })}
              {candidatureError && <p className="text-xs text-red-500">{candidatureError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Tutor — shown for all PF courses */}
      {corso.tipo === 'PF' && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Tutor assegnato</h2>
          {corso.tutor ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar nome={corso.tutor.nome} id={corso.tutor.id} initials={corso.tutor.avatar_initials} size="lg" />
                <div>
                  <div className="font-medium text-gray-900">{corso.tutor.nome}</div>
                  <a href={`mailto:${corso.tutor.email}`} className="text-sm text-blue-600 hover:underline">{corso.tutor.email}</a>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setTutorePickerOpen(true)}>Cambia</Button>
                  <Button variant="danger" size="sm" onClick={handleRemoveTutor}>Rimuovi</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-gray-400">
                Nessun tutor assegnato.{corso.tutor_nome && <span className="text-gray-500"> ({corso.tutor_nome})</span>}
              </p>
              {isAdmin && <Button size="sm" onClick={() => setTutorePickerOpen(true)}>Assegna Tutor</Button>}
            </div>
          )}
        </div>
      )}

      {/* Ore tutor section */}
      {corso.tipo === 'PF' && corso.tutor && oreTutoraggio > 0 && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Ore tutoraggio</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-[10px] p-4 text-center">
              <div className="text-xl font-bold text-gray-900">{oreTutoraggio}h</div>
              <div className="text-xs text-gray-500 mt-0.5">Assegnate</div>
            </div>
            <div className="bg-gray-50 rounded-[10px] p-4 text-center">
              <div className="text-xl font-bold text-gray-700">{oreTutorPianificate}h</div>
              <div className="text-xs text-gray-500 mt-0.5">Pianificate</div>
            </div>
            <div className="bg-gray-50 rounded-[10px] p-4 text-center">
              <div className={`text-xl font-bold ${oreTutorErogate >= oreTutoraggio ? 'text-green-600' : oreTutorErogate > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {oreTutorErogate}h
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Erogate</div>
            </div>
            <div className="rounded-[10px] p-4 text-center" style={{ backgroundColor: pctTutor >= 100 ? '#f0fdf4' : pctTutor > 0 ? '#eff6ff' : '#f9fafb' }}>
              <div className={`text-xl font-bold ${pctTutor >= 100 ? 'text-green-700' : pctTutor > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                {pctTutor}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Completamento</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Ore proporzionali al completamento delle sessioni di formazione.</p>
          {isAdmin && corso.tariffa_oraria_tutor != null && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {(() => {
                const tariffa = Number(corso.tariffa_oraria_tutor)
                const imponibile = oreTutorErogate * tariffa
                const ritenuta = imponibile * 0.20
                const netto = imponibile - ritenuta
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Imponibile ({oreTutorErogate}h × € {tariffa.toFixed(2)})</span>
                      <span className="font-medium text-gray-800">€ {imponibile.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Ritenuta 20%</span>
                      <span className="text-red-500">− € {ritenuta.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1.5 border-t border-gray-100">
                      <span className="font-medium text-gray-700">Netto al tutor</span>
                      <span className="font-semibold text-gray-900">€ {netto.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* Lettere d'incarico — admin */}
      {isAdmin && (corso.formatore_id || (corso.tipo === 'PF' && corso.tutor_id)) && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Lettere d&apos;incarico</h2>
          <div className="space-y-3">
            {corso.formatore_id && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-700">Lettera formatore</div>
                  <div className="mt-0.5">
                    {letteraUrl ? (
                      letteraFirmata ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          Firmata{letteraFirmataAt ? ` il ${new Date(letteraFirmataAt).toLocaleDateString('it-IT')}` : ''}
                        </span>
                      ) : letteraPending ? (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                          In invio (cron ore 18:00)
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                          Inviata — in attesa di firma
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">Non ancora generata</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {letteraUrl && (
                    <a href={letteraUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      PDF
                    </a>
                  )}
                  {letteraUrl && !letteraFirmata && (
                    <Button size="sm" variant="secondary" onClick={() => setAnnullaLetteraOpen(true)}>
                      Annulla
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={letteraUrl ? 'secondary' : undefined}
                    onClick={letteraUrl ? () => setRigeneraLetteraOpen(true) : handleGeneraLettera}
                    loading={generandoLettera}
                  >
                    {letteraUrl ? 'Rigenera' : 'Genera lettera'}
                  </Button>
                </div>
              </div>
            )}
            {generandoLetteraError && <p className="text-xs text-red-500">{generandoLetteraError}</p>}

            {corso.tipo === 'PF' && corso.tutor_id && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-gray-700">Lettera tutor</div>
                  <div className="mt-0.5">
                    {letteraTutorUrl ? (
                      letteraTutorFirmata ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          Firmata{letteraTutorFirmataAt ? ` il ${new Date(letteraTutorFirmataAt).toLocaleDateString('it-IT')}` : ''}
                        </span>
                      ) : letteraTutorPending ? (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                          In invio (cron ore 18:00)
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                          Inviata — in attesa di firma
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">Non ancora generata</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {letteraTutorUrl && (
                    <a href={letteraTutorUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      PDF
                    </a>
                  )}
                  {letteraTutorUrl && !letteraTutorFirmata && (
                    <Button size="sm" variant="secondary" onClick={() => setAnnullaLetteraTutorOpen(true)}>
                      Annulla
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={letteraTutorUrl ? 'secondary' : undefined}
                    onClick={letteraTutorUrl ? () => setRigeneraLetteraTutorOpen(true) : handleGeneraLetteraTutor}
                    loading={generandoLetteraTutor}
                  >
                    {letteraTutorUrl ? 'Rigenera' : 'Genera lettera'}
                  </Button>
                </div>
              </div>
            )}
            {generandoLetteraTutorError && <p className="text-xs text-red-500">{generandoLetteraTutorError}</p>}
          </div>
        </div>
      )}

      {/* Referente */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <h2 className="font-semibold text-gray-900 mb-4">Referente scolastico</h2>
        {corso.referente ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">{corso.referente.nome}</div>
              <a href={`mailto:${corso.referente.email}`} className="text-sm text-blue-600 hover:underline">{corso.referente.email}</a>
              {corso.referente.tel && <div className="text-sm text-gray-400 mt-0.5"><a href={`tel:${telHref(corso.referente.tel)}`} className="hover:text-blue-600">{corso.referente.tel}</a></div>}
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                {referenti.length > 1 && (
                  <Button variant="secondary" size="sm" onClick={() => setReferentePickerOpen(true)} loading={assigningReferente}>Cambia</Button>
                )}
                <Button variant="danger" size="sm" onClick={() => handleAssignReferente(null)} loading={assigningReferente}>Rimuovi</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-400">
              {referenti.length === 0
                ? 'Nessun referente disponibile per questa scuola.'
                : 'Nessun referente assegnato a questo corso.'}
            </p>
            {isAdmin && referenti.length > 0 && (
              <Button size="sm" onClick={() => setReferentePickerOpen(true)} loading={assigningReferente}>
                {referenti.length === 1 ? 'Assegna' : 'Seleziona referente'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Referenti section — visible to formatori */}
      {!isAdmin && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Referenti</h2>
          <div className="space-y-4">
            {/* A: Referente progetto */}
            {progetto && (progetto.ref_name || progetto.ref_email) && (
              <div>
                <div className="mb-1.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">Referente progetto</span>
                </div>
                <div className="pl-0.5">
                  {progetto.ref_name && <div className="font-medium text-gray-900 text-sm">{progetto.ref_name}</div>}
                  {progetto.ref_email && <a href={`mailto:${progetto.ref_email}`} className="text-sm text-blue-600 hover:underline">{progetto.ref_email}</a>}
                  {progetto.ref_tel && (
                    <div className="text-sm text-gray-400 mt-0.5">
                      <a href={`tel:${telHref(progetto.ref_tel)}`} className="text-blue-600 hover:underline">{progetto.ref_tel}</a>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* B: Referente corso */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="mb-1.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">Referente corso</span>
                </div>
                {corso.referente_corso_nome || corso.referente_corso_email ? (
                  <div className="pl-0.5">
                    {corso.referente_corso_nome && <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">{corso.referente_corso_nome}<RuoloBadge ruolo={corso.referente_corso_ruolo} /></div>}
                    {corso.referente_corso_email && (
                      <a href={`mailto:${corso.referente_corso_email}`} className="text-sm text-blue-600 hover:underline">{corso.referente_corso_email}</a>
                    )}
                    {corso.referente_corso_telefono && (
                      <div className="text-sm text-gray-400 mt-0.5">
                        <a href={`tel:${telHref(corso.referente_corso_telefono)}`} className="text-blue-600 hover:underline">{corso.referente_corso_telefono}</a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 pl-0.5">Nessun referente specifico per questo corso.</p>
                )}
              </div>
              <button
                onClick={() => {
                  setReferenteCorsoForm({
                    referente_corso_nome: corso.referente_corso_nome || '',
                    referente_corso_email: corso.referente_corso_email || '',
                    referente_corso_telefono: corso.referente_corso_telefono || '',
                    referente_corso_ruolo: corso.referente_corso_ruolo || '',
                  })
                  setReferenteCorsoEditOpen(true)
                }}
                className="shrink-0 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
              >
                {corso.referente_corso_nome ? 'Modifica' : 'Aggiungi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Referente corso (specifico per questo corso, diverso dal referente progetto) */}
      {isAdmin && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Referente corso</h2>
              <p className="text-xs text-gray-400 mt-0.5">Contatto specifico per questo corso</p>
            </div>
            <button
              onClick={() => {
                setReferenteCorsoForm({
                  referente_corso_nome: corso.referente_corso_nome || '',
                  referente_corso_email: corso.referente_corso_email || '',
                  referente_corso_telefono: corso.referente_corso_telefono || '',
                  referente_corso_ruolo: corso.referente_corso_ruolo || '',
                })
                setReferenteCorsoEditOpen(true)
              }}
              className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
            >
              {corso.referente_corso_nome ? 'Modifica' : 'Aggiungi'}
            </button>
          </div>
          {corso.referente_corso_nome || corso.referente_corso_email ? (
            <div>
              {corso.referente_corso_nome && <div className="font-medium text-gray-900">{corso.referente_corso_nome}</div>}
              {corso.referente_corso_email && (
                <a href={`mailto:${corso.referente_corso_email}`} className="text-sm text-blue-600 hover:underline">{corso.referente_corso_email}</a>
              )}
              {corso.referente_corso_telefono && <div className="text-sm text-gray-400 mt-0.5"><a href={`tel:${telHref(corso.referente_corso_telefono)}`} className="hover:text-blue-600">{corso.referente_corso_telefono}</a></div>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nessun referente corso specifico impostato.</p>
          )}
        </div>
      )}

      {/* Stato calendario */}
      {canConfirmSessions && corso.calendario_completo && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Stato calendario</h2>
          <div className="space-y-4">
            {/* Invio */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">Calendario inviato alla scuola</div>
                {calendarioInviatoAt ? (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Inviato il {new Date(calendarioInviatoAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 mt-0.5">Non ancora inviato</div>
                )}
              </div>
              {!calendarioInviatoAt ? (
                <div className="flex flex-col items-end gap-1">
                  <Button
                    size="sm"
                    loading={invioLoading}
                    onClick={handleInvioCalendario}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Invia calendario alla scuola
                  </Button>
                  {invioError && <p className="text-xs text-red-500">{invioError}</p>}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-md font-medium">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  Inviato
                </span>
              )}
            </div>

            {/* Conferma */}
            {calendarioInviatoAt && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-700">Calendario confermato dalla scuola</div>
                  {calendarioConfermatoLocal && corso.calendario_confermato_at && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Confermato il {new Date(corso.calendario_confermato_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleConfermaCalendario(!calendarioConfermatoLocal)}
                  disabled={confermaLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${calendarioConfermatoLocal ? 'bg-[#d64b55]' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${calendarioConfermatoLocal ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scheda corso */}
      {(corso.link_scheda || corso.descrizione || isAdmin) && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Scheda corso</h2>
            {isAdmin && (
              <button
                onClick={() => { setSchedaForm({ link_scheda: corso.link_scheda || '', descrizione: corso.descrizione || '' }); setSchedaEditOpen(true) }}
                className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
              >
                Modifica
              </button>
            )}
          </div>
          {corso.descrizione && (
            <p className="text-sm text-gray-600 mb-3">{corso.descrizione}</p>
          )}
          {corso.link_scheda ? (
            <a
              href={corso.link_scheda}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-white px-4 py-2 rounded-[7px] transition-colors"
              style={{ backgroundColor: '#1a73e8' }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Apri scheda su Google Drive
            </a>
          ) : isAdmin ? (
            <p className="text-sm text-gray-400">Nessun link scheda impostato.</p>
          ) : null}
        </div>
      )}

      {/* Note corso */}
      {(isAdmin || noteCorsoLocal) && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Note corso</h2>
            {isAdmin && (
              <button
                onClick={() => { setCorsoInfoForm({ edizione: edizioneLocal, note: noteCorsoLocal }); setCorsoInfoEditOpen(true) }}
                className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
              >
                {noteCorsoLocal || edizioneLocal ? 'Modifica' : 'Aggiungi'}
              </button>
            )}
          </div>
          {noteCorsoLocal ? (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{noteCorsoLocal}</p>
          ) : isAdmin ? (
            <p className="text-sm text-gray-400">Nessuna nota aggiunta.</p>
          ) : null}
        </div>
      )}

      {/* Tariffe incarico — admin: entrambe le tariffe + calcolo economico */}
      {isAdmin && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Tariffe incarico</h2>
          <div className="space-y-4">
            {/* Tariffa formatore */}
            <div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-700">
                    {corso.tipo === 'PF' && corso.tutor_previsto ? 'Tariffa formatore' : 'Tariffa oraria'}
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">
                    {(corso.tariffa_oraria ?? corso.formatore?.tariffa_oraria_formatore) != null
                      ? <>{`€ ${Number(corso.tariffa_oraria ?? corso.formatore?.tariffa_oraria_formatore).toFixed(2)}/h`}{corso.tariffa_oraria == null && <span className="ml-1 text-xs text-gray-400">(tariffa standard)</span>}</>
                      : <span className="text-gray-400">Non definita</span>}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => {
                  setTariffaForm(corso.tariffa_oraria != null ? String(corso.tariffa_oraria) : '')
                  setTariffaModalOpen(true)
                }}>
                  {corso.tariffa_oraria != null ? 'Modifica' : 'Imposta'}
                </Button>
              </div>
              {(corso.tariffa_oraria ?? corso.formatore?.tariffa_oraria_formatore) != null && oreErogate > 0 && (() => {
                const tariffa = Number(corso.tariffa_oraria ?? corso.formatore?.tariffa_oraria_formatore)
                const imponibile = +(oreErogate * tariffa).toFixed(2)
                const regime = corso.formatore?.regime_fiscale ?? 'notula'
                const rivalsaIva = corso.formatore?.rivalsa_iva ?? false
                const badgeClasses: Record<string, string> = {
                  forfettario: 'bg-green-100 text-green-700',
                  ordinario: 'bg-blue-100 text-blue-700',
                  notula: 'bg-orange-100 text-orange-700',
                }
                const badgeLabels: Record<string, string> = {
                  forfettario: 'Regime forfettario',
                  ordinario: rivalsaIva ? 'Regime ordinario + IVA 22%' : 'Regime ordinario',
                  notula: 'Prestazione occasionale',
                }
                return (
                  <div className="mt-2 space-y-1.5 bg-gray-50 rounded-[7px] px-3 py-2">
                    <div className="mb-2">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${badgeClasses[regime] ?? badgeClasses.notula}`}>
                        {badgeLabels[regime] ?? badgeLabels.notula}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Imponibile ({oreErogate}h × € {tariffa.toFixed(2)})</span>
                      <span className="font-medium text-gray-800">€ {imponibile.toFixed(2)}</span>
                    </div>
                    {regime === 'notula' && (() => {
                      const ritenuta = +(imponibile * 0.20).toFixed(2)
                      const netto = +(imponibile - ritenuta).toFixed(2)
                      return <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Ritenuta 20%</span>
                          <span className="text-red-500">− € {ritenuta.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-1.5 border-t border-gray-100">
                          <span className="font-medium text-gray-700">Netto al formatore</span>
                          <span className="font-semibold text-gray-900">€ {netto.toFixed(2)}</span>
                        </div>
                      </>
                    })()}
                    {regime === 'ordinario' && rivalsaIva && (() => {
                      const iva = +(imponibile * 0.22).toFixed(2)
                      const totale = +(imponibile + iva).toFixed(2)
                      return <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">IVA 22%</span>
                          <span className="text-blue-600">+ € {iva.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-1.5 border-t border-gray-100">
                          <span className="font-medium text-gray-700">Totale fattura</span>
                          <span className="font-semibold text-gray-900">€ {totale.toFixed(2)}</span>
                        </div>
                      </>
                    })()}
                    {(regime === 'forfettario' || (regime === 'ordinario' && !rivalsaIva)) && (
                      <div className="flex items-center justify-between text-sm pt-1.5 border-t border-gray-100">
                        <span className="font-medium text-gray-700">Importo da fatturare</span>
                        <span className="font-semibold text-gray-900">€ {imponibile.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Tariffa tutor — solo per corsi PF con tutor previsto */}
            {corso.tipo === 'PF' && corso.tutor_previsto && (
              <div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Tariffa tutor</div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      {corso.tariffa_oraria_tutor != null
                        ? `€ ${Number(corso.tariffa_oraria_tutor).toFixed(2)}/h`
                        : <span className="text-gray-400">Non definita</span>}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => {
                    setTariffaTutorForm(corso.tariffa_oraria_tutor != null ? String(corso.tariffa_oraria_tutor) : '')
                    setTariffaTutorModalOpen(true)
                  }}>
                    {corso.tariffa_oraria_tutor != null ? 'Modifica' : 'Imposta'}
                  </Button>
                </div>
              </div>
            )}

            {/* Fattura ricevuta toggle — solo per formatori P.IVA */}
            {corso.formatore?.ha_partita_iva && corso.formatore?.regime_fiscale !== 'notula' && oreErogate > 0 && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fatturaRicevuta}
                    onChange={async (e) => {
                      const val = e.target.checked
                      setFatturaRicevuta(val)
                      if (val) {
                        setFatturaRicevutaAt(new Date().toISOString())
                      } else {
                        setFatturaRicevutaAt(null)
                      }
                      await fetch(`/api/corsi/${corso.id}/fattura-ricevuta`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fattura_ricevuta: val }),
                      })
                      router.refresh()
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-green-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Fattura ricevuta</span>
                </label>
                {fatturaRicevuta && fatturaRicevutaAt && (
                  <span className="text-xs text-gray-500">
                    {new Date(fatturaRicevutaAt).toLocaleDateString('it-IT')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tariffe incarico — formatore: solo la propria tariffa (readonly) */}
      {!isAdmin && corso.formatore_id === currentUserId && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-3">La tua tariffa per questo corso</h2>
          {(() => {
            const tariffaEffettiva = corso.tariffa_oraria ?? corso.formatore?.tariffa_oraria_formatore ?? null
            const isStandard = corso.tariffa_oraria == null && tariffaEffettiva != null
            if (tariffaEffettiva != null) {
              return (
                <div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-gray-900">€ {Number(tariffaEffettiva).toFixed(2)}</span>
                    <span className="text-sm text-gray-400 mb-0.5">/h</span>
                  </div>
                  {isStandard && (
                    <p className="text-xs text-gray-400 mt-1.5">Tariffa standard del tuo profilo — può variare per questo ingaggio</p>
                  )}
                </div>
              )
            }
            return (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-[7px] px-3 py-2">
                Tariffa da definire — contatta l&apos;amministrazione
              </p>
            )
          })()}
        </div>
      )}

      {/* Tariffe incarico — tutor: solo la propria tariffa (readonly) */}
      {!isAdmin && corso.tutor_id === currentUserId && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-3">La tua tariffa per questo corso</h2>
          {corso.tariffa_oraria_tutor != null ? (
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-gray-900">€ {Number(corso.tariffa_oraria_tutor).toFixed(2)}</span>
              <span className="text-sm text-gray-400 mb-0.5">/h</span>
            </div>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-[7px] px-3 py-2">
              Tariffa da definire — contatta l&apos;amministrazione
            </p>
          )}
        </div>
      )}

      {/* Lettere d'incarico — vista admin (sola lettura) */}
      {isAdmin && (letteraUrl || letteraTutorUrl) && (
        <div id="lettera-incarico" className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Lettere d&apos;incarico</h2>
          <div className="divide-y divide-gray-100">
            {letteraUrl && (
              <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1.5">Lettera d&apos;incarico formatore</div>
                  {letteraFirmata ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-md">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                        Firmata digitalmente
                      </span>
                      {letteraFirmataAt && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          {`Firmata da ${corso.formatore?.nome || '—'} il ${new Date(letteraFirmataAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} alle ${new Date(letteraFirmataAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}${corso.lettera_incarico_ip ? ` (IP: ${corso.lettera_incarico_ip})` : ''}`}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                      In attesa di firma
                    </span>
                  )}
                </div>
                <a href={letteraUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors shrink-0"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Visualizza PDF
                </a>
              </div>
            )}
            {letteraTutorUrl && (
              <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1.5">Lettera d&apos;incarico tutoraggio</div>
                  {letteraTutorFirmata ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-md">
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                        Firmata digitalmente
                      </span>
                      {letteraTutorFirmataAt && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          {`Firmata da ${corso.tutor?.nome || '—'} il ${new Date(letteraTutorFirmataAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} alle ${new Date(letteraTutorFirmataAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}${corso.lettera_tutor_ip ? ` (IP: ${corso.lettera_tutor_ip})` : ''}`}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                      In attesa di firma
                    </span>
                  )}
                </div>
                <a href={letteraTutorUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors shrink-0"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Visualizza PDF
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lettera d'incarico — vista formatore */}
      {!isAdmin && corso.formatore_id === currentUserId && letteraUrl && (
        <div id="lettera-incarico" className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Lettera d&apos;incarico</h2>
          {letteraFirmata ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-100 px-3 py-1.5 rounded-md">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  Lettera firmata
                </span>
                {letteraFirmataAt && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Firmata il {new Date(letteraFirmataAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <a href={letteraUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
              >
                Visualizza PDF
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                È disponibile una lettera d&apos;incarico per questo corso. La preghiamo di visualizzarla e firmarla digitalmente.
              </p>
              <div className="flex items-center gap-3">
                <a href={letteraUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-[7px] transition-colors"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Visualizza lettera
                </a>
                <Button onClick={() => setFirmaLetteraOpen(true)}>Firma lettera</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lettera d'incarico tutoraggio — vista tutor */}
      {!isAdmin && corso.tutor_id === currentUserId && letteraTutorUrl && (
        <div id="lettera-incarico" className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <h2 className="font-semibold text-gray-900 mb-4">Lettera d&apos;incarico tutoraggio</h2>
          {letteraTutorFirmata ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-100 px-3 py-1.5 rounded-md">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  Lettera firmata
                </span>
                {letteraTutorFirmataAt && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Firmata il {new Date(letteraTutorFirmataAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <a href={letteraTutorUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
              >
                Visualizza PDF
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                È disponibile una lettera d&apos;incarico per il tutoraggio di questo corso. La preghiamo di visualizzarla e firmarla digitalmente.
              </p>
              <div className="flex items-center gap-3">
                <a href={letteraTutorUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-[7px] transition-colors"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Visualizza lettera
                </a>
                <Button onClick={() => setFirmaLetteraTutorOpen(true)}>Firma lettera</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottone corso completato — solo formatore quando 100% erogato */}
      {canMarkComplete && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-emerald-800 text-sm">Tutte le ore sono state erogate</div>
            <div className="text-xs text-emerald-600 mt-0.5">Puoi dichiarare il corso concluso per ricevere il riepilogo con le istruzioni di pagamento.</div>
          </div>
          <Button onClick={() => setCompletamentoModalOpen(true)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Corso completato
          </Button>
        </div>
      )}

      {/* Bottone segna come completato — solo admin quando 100% erogato e non ancora completato */}
      {canAdminMarkComplete && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-gray-700 text-sm">Tutte le ore sono state erogate</div>
            <div className="text-xs text-gray-400 mt-0.5">Il formatore non ha ancora segnato il corso come completato.</div>
          </div>
          <button
            onClick={() => setAdminCompletamentoModalOpen(true)}
            title="Il formatore non ha ancora segnato il corso come completato"
            className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-[7px] border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors whitespace-nowrap"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Segna come completato
          </button>
        </div>
      )}

      {/* Notula/crediti note — solo formatore assegnato quando corso completato */}
      {!isAdmin && corso.formatore_id === currentUserId && corsoCompletatoLocal && (
        <div className="bg-gray-50 rounded-xl p-5 mb-4 border border-gray-200">
          <p className="text-sm text-gray-600">
            {corso.formatore?.ha_partita_iva && corso.formatore?.regime_fiscale !== 'notula' ? (
              <>
                Corso completato. Vai a{' '}
                <Link href="/formatore/crediti" className="text-[#d64b55] hover:underline font-medium">
                  I miei crediti
                </Link>{' '}
                per visualizzare il tuo estratto conto e procedere con l&apos;emissione della fattura.
              </>
            ) : (
              <>
                Corso completato. Vai a{' '}
                <Link href="/formatore/notule" className="text-[#d64b55] hover:underline font-medium">
                  Le mie notule
                </Link>{' '}
                per generare la ricevuta di pagamento.
              </>
            )}
          </p>
        </div>
      )}

      {/* Sessioni */}
      <div className="bg-white rounded-xl mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900">Sessioni pianificate ({sessioni.length})</h2>
            {sessioni.length > 0 && sessioniScadute > 0 && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                {sessioniScadute} da confermare
              </span>
            )}
          </div>
          {canConfirmSessions && (
            <Button size="sm" onClick={() => setCalendarOpen(true)} disabled={oreResidue === 0}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Aggiungi Sessione
            </Button>
          )}
        </div>

        {sessioni.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            Nessuna sessione pianificata.
            {oreResidue > 0 && canConfirmSessions && (
              <div className="mt-1 text-xs">Clicca &quot;Aggiungi Sessione&quot; per iniziare.</div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {sessioni.map((s) => {
              const isPast = s.data <= today
              const canConfirm = canConfirmSessions && !s.completata && isPast
              const isFuture = s.data > today
              return (
                <div key={s.id} className={`px-6 py-3 ${s.completata ? 'bg-green-50/30' : ''}`}>
                  {/* Riga 1: data / orario / ore */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium text-gray-800 text-sm shrink-0">{formatDate(s.data)}</span>
                      {s.ora_inizio && s.ora_fine && (
                        <span className="text-sm text-gray-500 shrink-0">{s.ora_inizio.substring(0,5)}–{s.ora_fine.substring(0,5)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-gray-700">{s.ore}h</span>
                      {isIbrido && s.modalita_sessione && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${s.modalita_sessione === 'presenza' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                          {s.modalita_sessione === 'presenza' ? '🏫 Presenza' : '💻 Online'}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Riga 2: stato / azioni */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.completata ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                          </svg>
                          Completata
                        </span>
                        {s.completata_at && (
                          <span style={{ fontSize: '11px' }} className="text-gray-400 pl-0.5">Confermata il {formatDate(s.completata_at)}</span>
                        )}
                      </div>
                    ) : isFuture ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">Pianificata</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">Da confermare</span>
                    )}
                    {canConfirm && (
                      <button
                        onClick={() => handleConfirmSession(s.id)}
                        disabled={confirmingId === s.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[7px] transition-colors text-gray-600 hover:text-green-700 hover:bg-green-50 border border-gray-200 hover:border-green-300 disabled:opacity-50"
                      >
                        {confirmingId === s.id ? (
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                          </svg>
                        )}
                        Conferma
                      </button>
                    )}
                    {canConfirmSessions && !s.completata && (
                      <button
                        onClick={() => openEditModal(s)}
                        title="Modifica sessione"
                        className="p-1.5 rounded-[7px] text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                    {isAdmin && !s.completata && (
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        disabled={deletingId === s.id}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 ml-auto"
                      >
                        {deletingId === s.id ? '...' : 'Elimina'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Note ({note.length})</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNota}
              onChange={e => setNewNota(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNota() } }}
              placeholder="Scrivi una nota sul corso..."
              className="flex-1 text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors"
            />
            <Button size="sm" onClick={handleAddNota} loading={savingNota} disabled={!newNota.trim()}>
              Aggiungi
            </Button>
          </div>
          {note.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nessuna nota ancora.</p>
          ) : (
            <div className="space-y-2">
              {note.map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-[7px]">
                  {n.autore && (
                    <Avatar nome={n.autore.nome} id={n.autore.id} initials={n.autore.avatar_initials} size="sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{n.autore?.nome}</span>
                      <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 break-words">{n.testo}</p>
                  </div>
                  {(isAdmin || n.autore_id === currentUserId) && (
                    <button
                      onClick={() => handleDeleteNota(n.id)}
                      disabled={deletingNota === n.id}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0 disabled:opacity-50"
                    >
                      {deletingNota === n.id ? '...' : 'Elimina'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Storico modifiche calendario — solo admin */}
      {isAdmin && (() => {
        const MOTIV_LABELS: Record<string, string> = {
          richiesta_scuola: 'Richiesta della scuola',
          impegno_formatore: 'Impegno del formatore',
          causa_forza_maggiore: 'Causa di forza maggiore',
          problemi_tecnici_logistici: 'Problemi tecnici/logistici',
          accordo_reciproco: 'Accordo reciproco',
          altro: 'Altro',
        }
        const MOTIV_COLORS: Record<string, string> = {
          richiesta_scuola: 'bg-blue-100 text-blue-700',
          impegno_formatore: 'bg-orange-100 text-orange-700',
          causa_forza_maggiore: 'bg-gray-100 text-gray-600',
          problemi_tecnici_logistici: 'bg-yellow-100 text-yellow-700',
          accordo_reciproco: 'bg-green-100 text-green-700',
          altro: 'bg-red-100 text-red-700',
        }
        const TIPO_ICONS: Record<string, React.ReactNode> = {
          creazione: <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
          modifica_data: <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
          modifica_ore: <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
          eliminazione: <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
        }
        const TIPO_LABELS: Record<string, string> = {
          creazione: 'Creazione',
          modifica_data: 'Modifica data',
          modifica_ore: 'Modifica ore',
          eliminazione: 'Eliminazione',
        }
        return (
          <div className="bg-white rounded-xl mt-4" style={{ border: '0.5px solid #e5e5e5' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Storico modifiche calendario</h2>
              {!logLoaded && (
                <Button size="sm" variant="secondary" onClick={fetchLog} loading={loadingLog}>
                  Carica storico
                </Button>
              )}
            </div>
            {!logLoaded ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                Clicca &ldquo;Carica storico&rdquo; per visualizzare le modifiche alle sessioni.
              </div>
            ) : logModifiche.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">Nessuna modifica registrata.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {logModifiche.map(log => (
                  <div key={log.id} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-1.5 text-gray-500 mt-0.5 shrink-0">
                        {TIPO_ICONS[log.tipo_modifica]}
                        <span className="text-xs font-medium text-gray-600">{TIPO_LABELS[log.tipo_modifica] || log.tipo_modifica}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {log.data_precedente && log.data_nuova && (
                            <span className="text-xs text-gray-700">
                              <span className="line-through text-gray-400">{formatDate(log.data_precedente)}</span>
                              {' → '}
                              <span className="font-medium">{formatDate(log.data_nuova)}</span>
                            </span>
                          )}
                          {log.ore_precedenti != null && log.ore_nuove != null && (
                            <span className="text-xs text-gray-700">
                              <span className="line-through text-gray-400">{log.ore_precedenti}h</span>
                              {' → '}
                              <span className="font-medium">{log.ore_nuove}h</span>
                            </span>
                          )}
                          {log.motivazione_categoria && (
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${MOTIV_COLORS[log.motivazione_categoria] || 'bg-gray-100 text-gray-600'}`}>
                              {MOTIV_LABELS[log.motivazione_categoria] || log.motivazione_categoria}
                            </span>
                          )}
                        </div>
                        {log.motivazione_dettaglio && (
                          <p className="text-xs text-gray-500 mb-1">{log.motivazione_dettaglio}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {log.utente && <span>{log.utente.nome}</span>}
                          <span>·</span>
                          <span>{new Date(log.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Risultati questionari */}
      <QuestionariBlock questionari={questionari} showTexts={isAdmin} showStorico />

      {/* Modifica corso modal (admin only) */}
      <Modal
        open={corsoEditOpen}
        onClose={() => setCorsoEditOpen(false)}
        title="Modifica corso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCorsoEditOpen(false)}>Annulla</Button>
            <Button
              onClick={handleSaveCorsoEdit}
              loading={savingCorsoEdit}
              disabled={
                !corsoEditForm.title.trim() ||
                !corsoEditForm.ore_totali ||
                (corsoEditForm.tipo === 'PF' && !corsoEditForm.modalita) ||
                (['residenziale', 'semi_residenziale'].includes(corsoEditForm.modalita) && !corsoEditForm.location.trim())
              }
            >
              Salva modifiche
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Titolo corso *"
            value={corsoEditForm.title}
            onChange={e => setCorsoEditForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
              <select
                value={corsoEditForm.tipo}
                onChange={e => setCorsoEditForm(f => ({ ...f, tipo: e.target.value, modalita: 'presenza' as ModalitaCorso, location: '' }))}
                className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
              >
                <option value="PF">Percorso Formativo (PF)</option>
                <option value="Lab">Laboratorio sul Campo (Lab)</option>
              </select>
            </div>
            <Input
              label="Ore totali *"
              type="number"
              min={1}
              value={corsoEditForm.ore_totali}
              onChange={e => setCorsoEditForm(f => ({ ...f, ore_totali: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Modalità *</label>
            <select
              value={corsoEditForm.modalita}
              onChange={e => setCorsoEditForm(f => ({ ...f, modalita: e.target.value as ModalitaCorso, location: ['residenziale', 'semi_residenziale'].includes(e.target.value) ? f.location : '' }))}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
            >
              <option value="presenza">In presenza</option>
              {corsoEditForm.tipo === 'PF' && <option value="online">Online</option>}
              {corsoEditForm.tipo === 'PF' && <option value="ibrido">Ibrido (presenza + online)</option>}
              <option value="residenziale">Residenziale</option>
              <option value="semi_residenziale">Semi-residenziale</option>
            </select>
          </div>
          {['residenziale', 'semi_residenziale'].includes(corsoEditForm.modalita) && (
            <Input
              label="Location *"
              value={corsoEditForm.location}
              onChange={e => setCorsoEditForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Nome struttura, indirizzo..."
            />
          )}
          <Input
            label="Edizione"
            value={corsoEditForm.edizione}
            onChange={e => setCorsoEditForm(f => ({ ...f, edizione: e.target.value }))}
            placeholder="Es. 2024-2025"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
            <textarea
              value={corsoEditForm.note}
              onChange={e => setCorsoEditForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Note aggiuntive sul corso..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Edizione + note corso modal */}
      <Modal
        open={corsoInfoEditOpen}
        onClose={() => setCorsoInfoEditOpen(false)}
        title="Edizione e note corso"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCorsoInfoEditOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveCorsoInfo} loading={savingCorsoInfo}>Salva</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Edizione"
            value={corsoInfoForm.edizione}
            onChange={e => setCorsoInfoForm(f => ({ ...f, edizione: e.target.value }))}
            placeholder="Es. 2024-2025"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
            <textarea
              value={corsoInfoForm.note}
              onChange={e => setCorsoInfoForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Note aggiuntive sul corso..."
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Scheda corso modal */}
      <Modal
        open={schedaEditOpen}
        onClose={() => setSchedaEditOpen(false)}
        title="Modifica scheda corso"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSchedaEditOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveScheda} loading={savingScheda}>Salva</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Link Google Drive"
            value={schedaForm.link_scheda}
            onChange={e => setSchedaForm(f => ({ ...f, link_scheda: e.target.value }))}
            placeholder="https://drive.google.com/..."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrizione</label>
            <textarea
              value={schedaForm.descrizione}
              onChange={e => setSchedaForm(f => ({ ...f, descrizione: e.target.value }))}
              placeholder="Breve descrizione del corso…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Session Modal */}
      {(() => {
        const editOreMax = oreResidue + (editingSession ? Number(editingSession.ore) : 0)
        const editOreFromTimes = editOraInizio && editOraFine ? calcOreFromTime(editOraInizio, editOraFine) : 0
        const useTimePickers = !!(editOraInizio && editOraFine)
        const editOreNum = useTimePickers ? editOreFromTimes : Number(editOre)
        const editOreError = !useTimePickers && editOre && (editOreNum < 0.5 ? 'Min 0.5h' : editOreNum > editOreMax ? `Max ${editOreMax}h` : '')
        const needsDettaglio = editMotivazioneCategoria === 'altro'
        const canSubmitEdit = !!editMotivazioneCategoria &&
          (!needsDettaglio || editMotivazioneDettaglio.trim() !== '') &&
          !!editData && editOreNum > 0 && !editOreError

        const MOTIV_OPTIONS = [
          { value: 'richiesta_scuola', label: 'Richiesta della scuola' },
          { value: 'impegno_formatore', label: 'Impegno del formatore' },
          { value: 'causa_forza_maggiore', label: 'Causa di forza maggiore' },
          { value: 'problemi_tecnici_logistici', label: 'Problemi tecnici/logistici' },
          { value: 'accordo_reciproco', label: 'Accordo reciproco' },
          { value: 'altro', label: 'Altro' },
        ]

        return (
          <Modal
            open={editModalOpen}
            onClose={() => { setEditModalOpen(false); setEditingSession(null); setEditError(null) }}
            title={editingSession ? `Modifica sessione — ${formatDate(editingSession.data)}` : 'Modifica sessione'}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => { setEditModalOpen(false); setEditingSession(null) }}>Annulla</Button>
                <Button onClick={handleEditSession} loading={savingEdit} disabled={!canSubmitEdit}>Salva modifiche</Button>
              </>
            }
          >
            <div className="space-y-4">
              {editError && (
                <div className="bg-red-50 border border-red-200 rounded-[7px] px-3 py-2 text-sm text-red-700">{editError}</div>
              )}
              <Input
                label="Data sessione *"
                type="date"
                value={editData}
                onChange={e => setEditData(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ora inizio</label>
                  <input
                    type="time"
                    value={editOraInizio}
                    onChange={e => setEditOraInizio(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ora fine</label>
                  <input
                    type="time"
                    value={editOraFine}
                    onChange={e => setEditOraFine(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors"
                  />
                </div>
              </div>
              {useTimePickers ? (
                <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-[7px] px-3 py-2">
                  Durata calcolata: <span className="font-semibold">{editOreFromTimes}h</span>
                </div>
              ) : (
                <Input
                  label="Ore *"
                  type="number"
                  min={0.5}
                  step={0.5}
                  max={editOreMax}
                  value={editOre}
                  onChange={e => setEditOre(e.target.value)}
                  hint={`Max ${editOreMax}h`}
                  error={editOreError || undefined}
                />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Motivazione <span className="text-red-500">*</span>
                </label>
                <select
                  value={editMotivazioneCategoria}
                  onChange={e => setEditMotivazioneCategoria(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
                >
                  <option value="">— Seleziona motivazione —</option>
                  {MOTIV_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {(editMotivazioneCategoria || true) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Dettaglio{needsDettaglio ? <span className="text-red-500"> *</span> : <span className="text-gray-400"> (opzionale)</span>}
                  </label>
                  <textarea
                    value={editMotivazioneDettaglio}
                    onChange={e => setEditMotivazioneDettaglio(e.target.value)}
                    placeholder={needsDettaglio ? 'Descrivi il motivo della modifica…' : 'Aggiungi dettagli opzionali…'}
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none"
                  />
                </div>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* Calendar Modal */}
      <Modal
        open={calendarOpen}
        onClose={() => { setCalendarOpen(false); setNewData(''); setNewOre(''); setNewOraInizio(''); setNewOraFine(''); setNewModalitaSessione('presenza'); setSessionError(null) }}
        title="Aggiungi Sessione"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCalendarOpen(false); setNewData(''); setNewOre(''); setNewOraInizio(''); setNewOraFine(''); setNewModalitaSessione('presenza'); setSessionError(null) }}>Annulla</Button>
            <Button onClick={handleAddSession} loading={saving} disabled={!canSubmitSession}>
              Aggiungi Sessione
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {sessionError && (
            <div className="bg-red-50 border border-red-200 rounded-[7px] px-3 py-2.5 text-sm text-red-700">
              {sessionError}
            </div>
          )}
          <OreCounter oreTotali={Number(corso.ore_totali)} orePianificate={orePianificate} />
          <Input
            label="Data sessione *"
            type="date"
            value={newData}
            onChange={e => { setNewData(e.target.value); setSessionError(null) }}
          />
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
          {newOraInizio && newOraFine && (
            <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-[7px] px-3 py-2">
              Durata calcolata: <span className="font-semibold">{oreFromTimes}h</span>
            </div>
          )}
          {!(newOraInizio && newOraFine) && (
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
          {isIbrido && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Modalità sessione *</div>
              <div className="flex gap-3">
                {(['presenza', 'online'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewModalitaSessione(m)}
                    className="flex-1 py-2 px-3 rounded-[7px] border text-sm font-medium transition-all"
                    style={{
                      borderColor: newModalitaSessione === m ? '#d64b55' : '#e5e5e5',
                      backgroundColor: newModalitaSessione === m ? '#fbeced' : 'white',
                      color: newModalitaSessione === m ? '#d64b55' : '#555',
                    }}
                  >
                    {m === 'presenza' ? '🏫 In presenza' : '💻 Online'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {oreResidue === 0 && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-[7px] px-3 py-2">
              Calendario completo! Tutte le ore sono state pianificate.
            </div>
          )}
        </div>
      </Modal>

      {/* Formatore Picker Modal */}
      <Modal
        open={formatorePickerOpen}
        onClose={() => { setFormatorePickerOpen(false); setAssignError(null) }}
        title="Seleziona Formatore"
        size="lg"
      >
        {assignError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2 text-sm text-red-700">
            {assignError}
          </div>
        )}
        {formatori.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nessun formatore disponibile.</p>
        ) : (
          <div className="space-y-5">
            {suggestedScores.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className="text-amber-500">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                  </svg>
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Formatori suggeriti</span>
                </div>
                <div className="space-y-2">
                  {suggestedScores.map(({ formatore: f, score, skillScore, availScore, regionScore, skillMatches, totalCorsoTags, isAvailable, sameRegion }) => (
                    <FormatorePickerCard
                      key={f.id}
                      f={f}
                      score={score}
                      skillScore={skillScore}
                      availScore={availScore}
                      regionScore={regionScore}
                      skillMatches={skillMatches}
                      totalCorsoTags={totalCorsoTags}
                      isAvailable={isAvailable}
                      sameRegion={sameRegion}
                      isCurrent={f.id === corso.formatore_id}
                      isDualRole={dualRoleIds.includes(f.id)}
                      isAssigning={assigningId === f.id}
                      tasso={tassoAccettazioneMap[f.id] ?? null}
                      oreAssegnate={oreAssegnateMap[f.id]}
                      regioneRilevante={corso.modalita === 'presenza' || corso.modalita === 'residenziale' || corso.modalita === 'semi_residenziale' || corso.tipo === 'Lab'}
                      showScore
                      noTariffa={!f.tariffa_oraria_formatore}
                      onClick={() => handleAssignFormatore(f)}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherScores.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {suggestedScores.length > 0 ? 'Altri formatori' : 'Formatori'}
                  </span>
                </div>
                <div className="space-y-2">
                  {otherScores.map(({ formatore: f, score, skillScore, availScore, regionScore, skillMatches, totalCorsoTags, isAvailable, sameRegion }) => (
                    <FormatorePickerCard
                      key={f.id}
                      f={f}
                      score={score}
                      skillScore={skillScore}
                      availScore={availScore}
                      regionScore={regionScore}
                      skillMatches={skillMatches}
                      totalCorsoTags={totalCorsoTags}
                      isAvailable={isAvailable}
                      sameRegion={sameRegion}
                      isCurrent={f.id === corso.formatore_id}
                      isDualRole={dualRoleIds.includes(f.id)}
                      isAssigning={assigningId === f.id}
                      tasso={tassoAccettazioneMap[f.id] ?? null}
                      oreAssegnate={oreAssegnateMap[f.id]}
                      regioneRilevante={corso.modalita === 'presenza' || corso.modalita === 'residenziale' || corso.modalita === 'semi_residenziale' || corso.tipo === 'Lab'}
                      showScore={false}
                      noTariffa={!f.tariffa_oraria_formatore}
                      onClick={() => handleAssignFormatore(f)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Tutor Picker Modal */}
      <Modal
        open={tutorePickerOpen}
        onClose={() => { setTutorePickerOpen(false); setAssignError(null) }}
        title="Seleziona Tutor"
        size="md"
      >
        {assignError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2 text-sm text-red-700">
            {assignError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          {tutori.map((t) => (
            <button
              key={t.id}
              onClick={() => handleAssignTutor(t.id)}
              disabled={assigningId === 'tutor-' + t.id || t.id === corso.tutor_id}
              className="flex items-center gap-3 p-3 rounded-[7px] border text-left transition-all hover:border-[#d64b55] hover:bg-[#fbeced] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: t.id === corso.tutor_id ? '#d64b55' : '#e5e5e5',
                backgroundColor: t.id === corso.tutor_id ? '#fbeced' : 'white',
              }}
            >
              <Avatar nome={t.nome} id={t.id} initials={t.avatar_initials} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{t.nome}</div>
                <div className="text-xs text-gray-400">{t.email}</div>
              </div>
              {!t.tariffa_oraria_tutor && (
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0"
                  title="La tariffa verrà richiesta al momento dell'assegnazione"
                >
                  Tariffa mancante
                </span>
              )}
              {t.id === corso.tutor_id && <span className="text-xs text-[#d64b55] font-medium">Corrente</span>}
              {assigningId === 'tutor-' + t.id && (
                <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </button>
          ))}
          {tutori.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nessun tutor disponibile. Crea prima un utente con ruolo tutor.</p>
          )}
        </div>
      </Modal>

      {/* Tariffa Mancante Modal */}
      <Modal
        open={!!tariffaMancante}
        onClose={() => { setTariffaMancante(null); setTariffaMancanteError(null) }}
        title="Tariffa oraria mancante"
        size="sm"
      >
        {tariffaMancante && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>{tariffaMancante.userName}</strong> non ha una tariffa oraria impostata nel profilo.
              Inseriscila ora per procedere con l&apos;assegnazione.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Tariffa oraria</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">€</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="es. 40.00"
                  value={tariffaMancanteInput}
                  onChange={e => setTariffaMancanteInput(e.target.value)}
                  className="w-full pl-8 pr-10 py-2 border border-gray-200 rounded-[7px] text-sm focus:outline-none focus:border-[#d64b55]"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">/h</span>
              </div>
            </div>
            {tariffaMancanteError && (
              <div className="bg-red-50 border border-red-200 rounded-[7px] px-3 py-2 text-sm text-red-700">
                {tariffaMancanteError}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={() => { setTariffaMancante(null); setTariffaMancanteError(null) }}>
                Annulla
              </Button>
              <Button
                onClick={handleSaveTariffaEAssegna}
                loading={savingTariffaMancante}
                disabled={!tariffaMancanteInput || savingTariffaMancante}
              >
                Salva e assegna
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Referente Picker Modal */}
      <Modal
        open={referentePickerOpen}
        onClose={() => setReferentePickerOpen(false)}
        title="Seleziona Referente"
        size="md"
      >
        <div className="grid grid-cols-1 gap-3">
          {referenti.map((r) => (
            <button
              key={r.id}
              onClick={() => handleAssignReferente(r.id)}
              disabled={assigningReferente || r.id === corso.referente_id}
              className="flex items-center gap-3 p-3 rounded-[7px] border text-left transition-all hover:border-[#d64b55] hover:bg-[#fbeced] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: r.id === corso.referente_id ? '#d64b55' : '#e5e5e5',
                backgroundColor: r.id === corso.referente_id ? '#fbeced' : 'white',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{r.nome}</div>
                <div className="text-xs text-gray-400">{r.email}</div>
                {r.tel && <div className="text-xs text-gray-400"><a href={`tel:${telHref(r.tel)}`} className="hover:text-blue-600">{r.tel}</a></div>}
              </div>
              {r.id === corso.referente_id && <span className="text-xs text-[#d64b55] font-medium">Corrente</span>}
              {assigningReferente && r.id !== corso.referente_id && (
                <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </button>
          ))}
          {referenti.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nessun referente disponibile per questa scuola.</p>
          )}
        </div>
      </Modal>

      {/* Dual-role assignment dialog */}
      <Modal
        open={!!dualRoleUser}
        onClose={() => setDualRoleUser(null)}
        title="Aggiungi come Formatore o come Tutor?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDualRoleUser(null)}>Annulla</Button>
            <Button
              variant="secondary"
              onClick={() => { if (dualRoleUser) handleAssignTutor(dualRoleUser.id) }}
              loading={assigningId === 'tutor-' + dualRoleUser?.id}
            >
              Come Tutor
            </Button>
            <Button
              onClick={() => { if (dualRoleUser) doAssignFormatore(dualRoleUser.id) }}
              loading={assigningId === dualRoleUser?.id}
            >
              Come Formatore
            </Button>
          </>
        }
      >
        {dualRoleUser && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-[7px]">
            <Avatar nome={dualRoleUser.nome} id={dualRoleUser.id} initials={dualRoleUser.avatar_initials} size="lg" />
            <div>
              <div className="font-medium text-gray-900">{dualRoleUser.nome}</div>
              <div className="text-sm text-gray-400">{dualRoleUser.email}</div>
              <div className="text-xs text-indigo-600 mt-0.5">Ha entrambi i ruoli: Formatore e Tutor</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Referente corso modal */}
      <Modal
        open={referenteCorsoEditOpen}
        onClose={() => setReferenteCorsoEditOpen(false)}
        title="Referente corso"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReferenteCorsoEditOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveReferenteCorso} loading={savingReferenteCorso}>Salva</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            value={referenteCorsoForm.referente_corso_nome}
            onChange={e => setReferenteCorsoForm(f => ({ ...f, referente_corso_nome: e.target.value }))}
            placeholder="Nome referente..."
          />
          <Input
            label="Email"
            type="email"
            value={referenteCorsoForm.referente_corso_email}
            onChange={e => setReferenteCorsoForm(f => ({ ...f, referente_corso_email: e.target.value }))}
            placeholder="email@scuola.it"
          />
          <Input
            label="Telefono"
            value={referenteCorsoForm.referente_corso_telefono}
            onChange={e => setReferenteCorsoForm(f => ({ ...f, referente_corso_telefono: e.target.value }))}
            placeholder="+39 000 0000000"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
            <select
              value={referenteCorsoForm.referente_corso_ruolo}
              onChange={e => setReferenteCorsoForm(f => ({ ...f, referente_corso_ruolo: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleziona ruolo —</option>
              {RUOLI_REFERENTE.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <DeleteConfirmModal
        open={deleteCorsoOpen}
        onClose={() => setDeleteCorsoOpen(false)}
        title={`Elimina corso — ${corso.title}`}
        description={`Sei sicuro di voler eliminare il corso "${corso.title}"? Questa azione è irreversibile. Tutte le sessioni e le note correlate verranno eliminate definitivamente.`}
        confirmName="CANCELLA"
        onConfirm={async () => {
          const res = await fetch(`/api/corsi/${corso.id}`, { method: 'DELETE' })
          if (!res.ok) {
            const json = await res.json()
            throw new Error(json.error || 'Errore durante l\'eliminazione')
          }
          router.push(`/progetti/${progettoId}`)
        }}
      />

      <QuestionarioModal
        open={questionarioOpen}
        onClose={() => setQuestionarioOpen(false)}
        url={buildQuestionarioUrl({
          scuola: progetto?.school_name || '',
          titoloCorso: corso.title,
          formatore: corso.formatore?.nome || '',
          tipoCorso: corso.tipo || '',
          lineaFinanziamento: finanziamentoNome || '',
        })}
        titoloCorso={corso.title}
        corsoId={corso.id}
        hasFormatore={!!corso.formatore}
      />

      {/* Modal conferma completamento corso */}
      <Modal
        open={completamentoModalOpen}
        onClose={() => { setCompletamentoModalOpen(false); setCompletamentoError(null) }}
        title="Conferma completamento corso"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompletamentoModalOpen(false)}>Annulla</Button>
            <Button onClick={handleCompletaCorso} loading={completamentoLoading}>Conferma</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Confermi il completamento del corso <strong>{corso.title}</strong> presso <strong>{progetto?.school_name}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Verrà inviata una mail riepilogativa con le istruzioni per il pagamento.
          </p>
          {completamentoError && <p className="text-sm text-red-600">{completamentoError}</p>}
        </div>
      </Modal>

      {/* Modal conferma completamento corso — admin */}
      <Modal
        open={adminCompletamentoModalOpen}
        onClose={() => { setAdminCompletamentoModalOpen(false); setCompletamentoError(null) }}
        title="Segna corso come completato"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdminCompletamentoModalOpen(false)}>Annulla</Button>
            <Button onClick={handleAdminCompletaCorso} loading={completamentoLoading}>Conferma</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Vuoi segnare il corso <strong>{corso.title}</strong> come completato al posto del formatore?
          </p>
          <p className="text-sm text-gray-500">
            Verrà inviata la mail di riepilogo al formatore con le istruzioni per il pagamento.
          </p>
          {completamentoError && <p className="text-sm text-red-600">{completamentoError}</p>}
        </div>
      </Modal>

      {/* Modal tariffa oraria (admin only) */}
      <Modal
        open={tariffaModalOpen}
        onClose={() => setTariffaModalOpen(false)}
        title="Tariffa oraria"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTariffaModalOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveTariffa} loading={savingTariffa}>Salva</Button>
          </>
        }
      >
        <Input
          label="Tariffa oraria (€)"
          type="number"
          min={0}
          step={0.01}
          value={tariffaForm}
          onChange={e => setTariffaForm(e.target.value)}
          placeholder="Es. 45.00"
          hint="Lascia vuoto per rimuovere la tariffa"
        />
      </Modal>

      {/* Modal tariffa tutor (admin only) */}
      <Modal
        open={tariffaTutorModalOpen}
        onClose={() => setTariffaTutorModalOpen(false)}
        title="Tariffa oraria tutor"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTariffaTutorModalOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveTariffaTutor} loading={savingTariffaTutor}>Salva</Button>
          </>
        }
      >
        <Input
          label="Tariffa oraria tutor (€)"
          type="number"
          min={0}
          step={0.01}
          value={tariffaTutorForm}
          onChange={e => setTariffaTutorForm(e.target.value)}
          placeholder="Es. 25.00"
          hint="Lascia vuoto per rimuovere la tariffa"
        />
      </Modal>

      {/* Firma lettera formatore modal */}
      <Modal
        open={firmaLetteraOpen}
        onClose={() => { setFirmaLetteraOpen(false); setFirmaLetteraError(null) }}
        title="Firma lettera d'incarico"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setFirmaLetteraOpen(false); setFirmaLetteraError(null) }}>Annulla</Button>
            <Button onClick={handleFirmaLettera} loading={firmandoLettera}>Firma</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Firmando digitalmente questa lettera, confermo di aver letto e accettato le condizioni dell&apos;incarico di formazione.
          </p>
          <p className="text-xs text-gray-400">
            La firma digitale includerà la data e l&apos;indirizzo IP del tuo dispositivo. L&apos;operazione è irreversibile.
          </p>
          {firmaLetteraError && <p className="text-xs text-red-500">{firmaLetteraError}</p>}
        </div>
      </Modal>

      {/* Firma lettera tutor modal */}
      <Modal
        open={firmaLetteraTutorOpen}
        onClose={() => { setFirmaLetteraTutorOpen(false); setFirmaLetteraTutorError(null) }}
        title="Firma lettera d'incarico tutoraggio"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setFirmaLetteraTutorOpen(false); setFirmaLetteraTutorError(null) }}>Annulla</Button>
            <Button onClick={handleFirmaLetteraTutor} loading={firmandoLetteraTutor}>Firma</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Firmando digitalmente questa lettera, confermo di aver letto e accettato le condizioni dell&apos;incarico di tutoraggio.
          </p>
          <p className="text-xs text-gray-400">
            La firma digitale includerà la data e l&apos;indirizzo IP del tuo dispositivo. L&apos;operazione è irreversibile.
          </p>
          {firmaLetteraTutorError && <p className="text-xs text-red-500">{firmaLetteraTutorError}</p>}
        </div>
      </Modal>

      {/* Rigenera lettera formatore modal */}
      <Modal
        open={rigeneraLetteraOpen}
        onClose={() => setRigeneraLetteraOpen(false)}
        title="Rigenera lettera d'incarico"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRigeneraLetteraOpen(false)}>Annulla</Button>
            <Button onClick={handleGeneraLettera} loading={generandoLettera}>Rigenera</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          La lettera precedente verrà sostituita con una nuova versione aggiornata. Il formatore riceverà una notifica via email e la nuova lettera verrà inviata con la prossima spedizione giornaliera.
        </p>
      </Modal>

      {/* Rigenera lettera tutor modal */}
      <Modal
        open={rigeneraLetteraTutorOpen}
        onClose={() => setRigeneraLetteraTutorOpen(false)}
        title="Rigenera lettera d'incarico tutoraggio"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRigeneraLetteraTutorOpen(false)}>Annulla</Button>
            <Button onClick={handleGeneraLetteraTutor} loading={generandoLetteraTutor}>Rigenera</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          La lettera precedente verrà sostituita con una nuova versione aggiornata. Il tutor riceverà una notifica via email e la nuova lettera verrà inviata con la prossima spedizione giornaliera.
        </p>
      </Modal>

      {/* Annulla lettera formatore modal */}
      <Modal
        open={annullaLetteraOpen}
        onClose={() => { setAnnullaLetteraOpen(false); setAnnullaLetteraMotivo(''); setAnnullaLetteraError(null) }}
        title="Annulla lettera d'incarico"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAnnullaLetteraOpen(false); setAnnullaLetteraMotivo(''); setAnnullaLetteraError(null) }}>Chiudi</Button>
            <Button variant="danger" onClick={handleAnnullaLettera} loading={annullandoLettera}>Annulla lettera</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            La lettera verrà annullata e il formatore riceverà una email di notifica. Questa operazione è irreversibile.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo annullamento (opzionale)</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={annullaLetteraMotivo}
              onChange={e => setAnnullaLetteraMotivo(e.target.value)}
              placeholder="Es. dati aggiornati, riassegnazione corso..."
            />
          </div>
          {annullaLetteraError && <p className="text-xs text-red-500">{annullaLetteraError}</p>}
        </div>
      </Modal>

      {/* Annulla lettera tutor modal */}
      <Modal
        open={annullaLetteraTutorOpen}
        onClose={() => { setAnnullaLetteraTutorOpen(false); setAnnullaLetteraTutorMotivo(''); setAnnullaLetteraTutorError(null) }}
        title="Annulla lettera d'incarico tutoraggio"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAnnullaLetteraTutorOpen(false); setAnnullaLetteraTutorMotivo(''); setAnnullaLetteraTutorError(null) }}>Chiudi</Button>
            <Button variant="danger" onClick={handleAnnullaLetteraTutor} loading={annullandoLetteraTutor}>Annulla lettera</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            La lettera verrà annullata e il tutor riceverà una email di notifica. Questa operazione è irreversibile.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo annullamento (opzionale)</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={annullaLetteraTutorMotivo}
              onChange={e => setAnnullaLetteraTutorMotivo(e.target.value)}
              placeholder="Es. dati aggiornati, riassegnazione corso..."
            />
          </div>
          {annullaLetteraTutorError && <p className="text-xs text-red-500">{annullaLetteraTutorError}</p>}
        </div>
      </Modal>
    </div>
  )
}

