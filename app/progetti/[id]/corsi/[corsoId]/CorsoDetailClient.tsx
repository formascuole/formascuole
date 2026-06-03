'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CorsoConOre, Sessione, Profile, Progetto, NotaCorso, Referente, QuestionarioRisultato, Candidatura } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { QuestionariBlock } from '@/components/ui/QuestionariBlock'
import { QuestionarioModal, buildQuestionarioUrl } from '@/components/ui/QuestionarioModal'

interface CorsoDetailClientProps {
  corso: CorsoConOre & { formatore?: Profile; tutor?: Profile; referente?: Referente }
  progetto: Pick<Progetto, 'school_name' | 'anno_scolastico' | 'ref_name' | 'ref_email' | 'ref_tel' | 'finanziamento_id'> | null
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
  /** True if the current user can confirm sessions (admin or the assigned formatore) */
  canConfirmSessions: boolean
  isSuperAdmin?: boolean
}

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
}: CorsoDetailClientProps) {
  const router = useRouter()
  const [sessioni, setSessioni] = useState<Sessione[]>(initialSessioni)
  useEffect(() => { setSessioni(initialSessioni) }, [initialSessioni])
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assigningReferente, setAssigningReferente] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Dual-role dialog state
  const [dualRoleUser, setDualRoleUser] = useState<Profile | null>(null)

  // Notes state
  const [note, setNote] = useState<NotaCorso[]>(initialNote)
  useEffect(() => { setNote(initialNote) }, [initialNote])
  const [newNota, setNewNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)
  const [deletingNota, setDeletingNota] = useState<string | null>(null)

  const [questionarioOpen, setQuestionarioOpen] = useState(false)

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
  const [completamentoLoading, setCompletamentoLoading] = useState(false)
  const [completamentoError, setCompletamentoError] = useState<string | null>(null)
  const [corsoCompletatoLocal, setCorsoCompletatoLocal] = useState(corso.corso_completato ?? false)
  const [corsoCompletatoAtLocal, setCorsoCompletatoAtLocal] = useState(corso.corso_completato_at ?? null)

  // Tariffa oraria (admin edit)
  const [tariffaModalOpen, setTariffaModalOpen] = useState(false)
  const [tariffaForm, setTariffaForm] = useState(corso.tariffa_oraria != null ? String(corso.tariffa_oraria) : '')
  const [savingTariffa, setSavingTariffa] = useState(false)

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
        router.refresh()
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
        setAssignError(j.error || 'Errore durante l\'assegnazione')
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
        setAssignError(j.error || 'Errore durante l\'assegnazione')
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

  const canMarkComplete = !isAdmin && !corsoCompletatoLocal && oreErogate >= Number(corso.ore_totali) && Number(corso.ore_totali) > 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{corso.title}</h1>
            <StatusBadge variant={corso.tipo} />
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
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setQuestionarioOpen(true)}
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
        {corso.tipo === 'PF' && (
          <div className="flex flex-wrap gap-2 mb-4">
            {corso.modalita && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 text-gray-600">
                {corso.modalita === 'presenza' ? '🏫 In presenza' : corso.modalita === 'online' ? '💻 Online' : '🔀 Ibrido'}
              </span>
            )}
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
              {corso.referente.tel && <div className="text-sm text-gray-400 mt-0.5">{corso.referente.tel}</div>}
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
              {corso.referente_corso_telefono && <div className="text-sm text-gray-400 mt-0.5">{corso.referente_corso_telefono}</div>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nessun referente corso specifico impostato.</p>
          )}
        </div>
      )}

      {/* Stato calendario */}
      {isAdmin && corso.calendario_completo && (
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

      {/* Tariffa oraria */}
      {(isAdmin || (corso.tariffa_oraria != null && !isAdmin)) && (
        <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Tariffa oraria</h2>
              <p className="text-sm text-gray-600 mt-1">
                {corso.tariffa_oraria != null
                  ? `€ ${Number(corso.tariffa_oraria).toFixed(2)}/h`
                  : <span className="text-gray-400">Non definita</span>
                }
              </p>
            </div>
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => {
                setTariffaForm(corso.tariffa_oraria != null ? String(corso.tariffa_oraria) : '')
                setTariffaModalOpen(true)
              }}>
                {corso.tariffa_oraria != null ? 'Modifica' : 'Imposta'}
              </Button>
            )}
          </div>
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
          {isAdmin && (
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
            {oreResidue > 0 && isAdmin && (
              <div className="mt-1 text-xs">Clicca &quot;Aggiungi Sessione&quot; per iniziare.</div>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">DATA</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ORARIO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ORE</th>
                {isIbrido && <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">MODALITÀ</th>}
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">STATO</th>
                {canConfirmSessions && <th className="px-6 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sessioni.map((s) => {
                const isPast = s.data <= today
                const canConfirm = canConfirmSessions && !s.completata && isPast
                const isFuture = s.data > today
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 ${s.completata ? 'bg-green-50/30' : ''}`}>
                    <td className="px-6 py-3 text-sm text-gray-800 font-medium">{formatDate(s.data)}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {s.ora_inizio && s.ora_fine
                        ? `${s.ora_inizio.substring(0,5)}–${s.ora_fine.substring(0,5)}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-800">{s.ore}h</td>
                    {isIbrido && (
                      <td className="px-6 py-3">
                        {s.modalita_sessione ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${s.modalita_sessione === 'presenza' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                            {s.modalita_sessione === 'presenza' ? '🏫 Presenza' : '💻 Online'}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    )}
                    <td className="px-6 py-3">
                      {s.completata ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                            Completata
                          </span>
                          {s.completata_at && (
                            <span className="text-xs text-gray-400">{formatDate(s.completata_at)}</span>
                          )}
                        </div>
                      ) : isFuture ? (
                        <span className="text-xs text-gray-400">Futura</span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                          Da confermare
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canConfirmSessions && (
                          <button
                            onClick={() => canConfirm ? handleConfirmSession(s.id) : undefined}
                            disabled={!canConfirm || confirmingId === s.id}
                            title={isFuture ? `Disponibile dal ${formatDate(s.data)}` : s.completata ? 'Già confermata' : 'Segna come completata'}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[7px] transition-colors ${
                              s.completata
                                ? 'text-green-600 bg-green-50 cursor-default'
                                : canConfirm
                                ? 'text-gray-600 hover:text-green-700 hover:bg-green-50 border border-gray-200 hover:border-green-300'
                                : 'text-gray-300 cursor-not-allowed'
                            }`}
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
                            {s.completata ? 'Confermata' : 'Conferma'}
                          </button>
                        )}
                        {canConfirmSessions && !s.completata && (
                          <button
                            onClick={() => openEditModal(s)}
                            title="Modifica sessione"
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 px-2 py-1 rounded-[6px] transition-colors"
                          >
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Modifica
                          </button>
                        )}
                        {isAdmin && !s.completata && (
                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            disabled={deletingId === s.id}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingId === s.id ? '...' : 'Elimina'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
        onClose={() => { setCalendarOpen(false); setNewData(''); setNewOre(''); setNewOraInizio(''); setNewOraFine(''); setNewModalitaSessione('presenza') }}
        title="Aggiungi Sessione"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCalendarOpen(false); setNewData(''); setNewOre(''); setNewOraInizio(''); setNewOraFine(''); setNewModalitaSessione('presenza') }}>Annulla</Button>
            <Button onClick={handleAddSession} loading={saving} disabled={!canSubmitSession}>
              Aggiungi Sessione
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <OreCounter oreTotali={Number(corso.ore_totali)} orePianificate={orePianificate} />
          <Input
            label="Data sessione *"
            type="date"
            value={newData}
            onChange={e => setNewData(e.target.value)}
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
        size="md"
      >
        {assignError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2 text-sm text-red-700">
            {assignError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          {formatori.map((f) => (
            <button
              key={f.id}
              onClick={() => handleAssignFormatore(f)}
              disabled={assigningId === f.id || f.id === corso.formatore_id}
              className="flex items-center gap-3 p-3 rounded-[7px] border text-left transition-all hover:border-[#d64b55] hover:bg-[#fbeced] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: f.id === corso.formatore_id ? '#d64b55' : '#e5e5e5',
                backgroundColor: f.id === corso.formatore_id ? '#fbeced' : 'white',
              }}
            >
              <Avatar nome={f.nome} id={f.id} initials={f.avatar_initials} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                  {f.nome}
                  {dualRoleIds.includes(f.id) && (
                    <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Formatore + Tutor</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{f.email}</div>
              </div>
              {f.id === corso.formatore_id && <span className="text-xs text-[#d64b55] font-medium">Corrente</span>}
              {assigningId === f.id && (
                <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </button>
          ))}
          {formatori.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nessun formatore disponibile.</p>
          )}
        </div>
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
                {r.tel && <div className="text-xs text-gray-400">{r.tel}</div>}
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
        </div>
      </Modal>

      <DeleteConfirmModal
        open={deleteCorsoOpen}
        onClose={() => setDeleteCorsoOpen(false)}
        title={`Elimina corso — ${corso.title}`}
        description={`Sei sicuro di voler eliminare il corso "${corso.title}"? Questa azione è irreversibile. Tutte le sessioni e le note correlate verranno eliminate definitivamente.`}
        confirmName={corso.title}
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
    </div>
  )
}

