'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProgettoConStats, CorsoConOre, Profile, ChatMessaggio, Referente, Finanziamento, Partner, CatalogoCorso, QuestionarioRisultato } from '@/lib/types'
import { calcCommissionePartner, fmtCur } from '@/lib/economia-utils'
import { QuestionariBlock } from '@/components/ui/QuestionariBlock'
import { getFinanziamentoColor, formatAddress } from '@/app/progetti/ProgettiClient'
import { GeoSelect } from '@/components/GeoSelect'
import { RUOLI_REFERENTE } from '@/lib/ruolo-referente'
import { RuoloBadge } from '@/components/ui/RuoloBadge'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { ModalitaIcon } from '@/components/ui/ModalitaIcon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate, telHref } from '@/lib/utils'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

interface ProgettoDetailClientProps {
  progetto: ProgettoConStats
  corsi: CorsoConOre[]
  formatori: Profile[]
  messaggi: ChatMessaggio[]
  referenti: Referente[]
  finanziamenti: Finanziamento[]
  partners: Partner[]
  catalogo: CatalogoCorso[]
  currentUserId: string
  isSuperAdmin?: boolean
  questionari?: QuestionarioRisultato[]
  oreErogatePerCorso?: Record<string, number>
  oreAssegnateMap?: Record<string, number>
}

type EditScuolaForm = {
  school_name: string
  address: string
  anno_scolastico: string
  finanziamento_id: string
  partner_id: string
  quota_progettazione: string
  quota_progettazione_note: string
  status: string
  regione: string
  provincia: string
  citta: string
}

type ReferenteForm = { nome: string; email: string; tel: string; ruolo: string }
const emptyReferenteForm: ReferenteForm = { nome: '', email: '', tel: '', ruolo: '' }

type BulkRowState = { formatoreId: string; tariffa: string }

type BulkAddEdizione = {
  ore_totali: string
  modalita: string
  tutor_previsto: boolean
  ore_tutoraggio: string
  edizione: string
  location: string
}

type BulkAddRow = {
  catalogoId: string
  title: string
  tipo: string
  descrizione: string
  link_scheda: string
  qty: number
  editions: BulkAddEdizione[]
}

export function ProgettoDetailClient({
  progetto,
  corsi,
  formatori,
  messaggi: initialMessaggi,
  referenti: initialReferenti,
  finanziamenti,
  partners,
  catalogo,
  currentUserId,
  isSuperAdmin,
  questionari = [],
  oreErogatePerCorso = {},
  oreAssegnateMap = {},
}: ProgettoDetailClientProps) {
  const router = useRouter()

  // ── Delete progetto ──────────────────────────────────────────
  const [deleteProgettoOpen, setDeleteProgettoOpen] = useState(false)

  // ── Notifica assegnazioni ─────────────────────────────────────
  const [notificaOpen, setNotificaOpen] = useState(false)
  const [notificaSelected, setNotificaSelected] = useState<Set<string>>(new Set())
  const [sendingNotifiche, setSendingNotifiche] = useState(false)
  const [notificaError, setNotificaError] = useState('')

  // ── Conferma pre-assegnazioni ─────────────────────────────────
  const [preConfirmOpen, setPreConfirmOpen] = useState(false)
  const [preConfirmSelected, setPreConfirmSelected] = useState<Set<string>>(new Set())
  const [confirmingPre, setConfirmingPre] = useState(false)

  // ── Corso form ──────────────────────────────────────────────
  const [addCorsoOpen, setAddCorsoOpen] = useState(false)
  const [addCorsoStep, setAddCorsoStep] = useState<1 | 2>(1)
  const [catalogoSearch, setCatalogoSearch] = useState('')
  const [savingCorso, setSavingCorso] = useState(false)
  const [corsoForm, setCorsoForm] = useState({
    title: '', tipo: 'PF', ore_totali: '', modalita: 'presenza',
    tutor_previsto: false, tutor_nome: '', ore_tutoraggio: '',
    descrizione: '', link_scheda: '', edizione: '', note: '', location: '',
  })

  // ── Edit scuola ─────────────────────────────────────────────
  const [editScuolaOpen, setEditScuolaOpen] = useState(false)
  const [editScuolaForm, setEditScuolaForm] = useState<EditScuolaForm>({
    school_name: progetto.school_name,
    address: progetto.address,
    anno_scolastico: progetto.anno_scolastico || '',
    finanziamento_id: (progetto as ProgettoConStats & { finanziamento_id?: string | null }).finanziamento_id || '',
    partner_id: progetto.partner_id || '',
    quota_progettazione: String(progetto.quota_progettazione ?? ''),
    quota_progettazione_note: progetto.quota_progettazione_note ?? '',
    status: progetto.status,
    regione: progetto.regione ?? '',
    provincia: progetto.provincia ?? '',
    citta: progetto.citta ?? '',
  })
  const [savingScuola, setSavingScuola] = useState(false)
  const [scuolaError, setScuolaError] = useState('')

  // ── Referenti ───────────────────────────────────────────────
  const [referenti, setReferenti] = useState<Referente[]>(initialReferenti)
  const [addRefOpen, setAddRefOpen] = useState(false)
  const [addRefForm, setAddRefForm] = useState(emptyReferenteForm)
  const [savingRef, setSavingRef] = useState(false)
  const [refError, setRefError] = useState('')
  const [editRef, setEditRef] = useState<Referente | null>(null)
  const [editRefForm, setEditRefForm] = useState(emptyReferenteForm)
  const [savingEditRef, setSavingEditRef] = useState(false)
  const [editRefError, setEditRefError] = useState('')
  // ── Edit referente principale ────────────────────────────────
  const [mainRef, setMainRef] = useState({ nome: progetto.ref_name, email: progetto.ref_email, tel: progetto.ref_tel || '', ruolo: progetto.ref_ruolo || '' })
  const [editMainRefOpen, setEditMainRefOpen] = useState(false)
  const [editMainRefForm, setEditMainRefForm] = useState(emptyReferenteForm)
  const [savingMainRef, setSavingMainRef] = useState(false)
  const [mainRefError, setMainRefError] = useState('')
  const [deletingRefId, setDeletingRefId] = useState<string | null>(null)

  // ── Assegnazione massiva ─────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFormMap, setBulkFormMap] = useState<Record<string, BulkRowState>>({})
  const [existingFormMap, setExistingFormMap] = useState<Record<string, BulkRowState>>({})
  const [existingExpanded, setExistingExpanded] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkResults, setBulkResults] = useState<{ successi: string[]; errori: { corso: string; err: string }[] } | null>(null)
  const [bulkValidationErrors, setBulkValidationErrors] = useState<Set<string>>(new Set())

  // ── Cancellazione massiva ────────────────────────────────────
  const [deleteSelected, setDeleteSelected] = useState<Set<string>>(new Set())
  const [deleteBulkOpen, setDeleteBulkOpen] = useState(false)
  const [deleteBulkConfirmText, setDeleteBulkConfirmText] = useState('')
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [deleteBulkError, setDeleteBulkError] = useState('')

  // ── Aggiunta massiva corsi ───────────────────────────────────
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkAddStep, setBulkAddStep] = useState<1 | 2>(1)
  const [bulkAddSearch, setBulkAddSearch] = useState('')
  const [bulkAddSelected, setBulkAddSelected] = useState<Set<string>>(new Set())
  const [bulkAddRows, setBulkAddRows] = useState<Record<string, BulkAddRow>>({})
  const [savingBulkAdd, setSavingBulkAdd] = useState(false)
  const [bulkAddProgress, setBulkAddProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkAddResults, setBulkAddResults] = useState<{ successi: string[]; errori: string[] } | null>(null)

  // ── Chat ────────────────────────────────────────────────────
  const [messaggi, setMessaggi] = useState<ChatMessaggio[]>(initialMessaggi)
  const [newMsg, setNewMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messaggi])

  useEffect(() => {
    const unread = initialMessaggi
      .filter(m => !m.letto && m.autore_id !== currentUserId)
      .map(m => m.id)
    if (unread.length > 0) {
      fetch('/api/chat/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaggio_ids: unread }),
      }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progettoFinanziamento = finanziamenti.find(f => f.id === progetto.finanziamento_id)
  const isDM38 = progettoFinanziamento?.nome?.includes('38') ?? false
  const progettoFinanziamentoNome = progettoFinanziamento?.nome ?? null

  const resetAddCorso = () => {
    setAddCorsoStep(1)
    setCatalogoSearch('')
    setCorsoForm({ title: '', tipo: isDM38 ? 'MF' : 'PF', ore_totali: isDM38 ? '30' : '', modalita: 'presenza', tutor_previsto: false, tutor_nome: '', ore_tutoraggio: '', descrizione: '', link_scheda: '', edizione: '', note: '', location: '' })
  }

  const selectFromCatalogo = (c: CatalogoCorso) => {
    setCorsoForm(f => ({
      ...f,
      title: c.titolo,
      tipo: isDM38 ? 'MF' : c.tipo,
      ore_totali: isDM38 ? '30' : '',
      modalita: 'presenza',
      descrizione: c.descrizione || '',
      link_scheda: c.link_scheda || '',
    }))
    setAddCorsoStep(2)
  }

  // ── Handlers: corso ─────────────────────────────────────────
  const handleAddCorso = async () => {
    setSavingCorso(true)
    try {
      const res = await fetch('/api/corsi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: progetto.id,
          title: corsoForm.title,
          tipo: corsoForm.tipo,
          ore_totali: Number(corsoForm.ore_totali),
          modalita: corsoForm.modalita || null,
          tutor_previsto: corsoForm.tutor_previsto,
          ...(corsoForm.tutor_previsto && corsoForm.tutor_nome && { tutor_nome: corsoForm.tutor_nome }),
          ...(corsoForm.tutor_previsto && corsoForm.ore_tutoraggio && { ore_tutoraggio: Number(corsoForm.ore_tutoraggio) }),
          ...(corsoForm.descrizione && { descrizione: corsoForm.descrizione }),
          ...(corsoForm.link_scheda && { link_scheda: corsoForm.link_scheda }),
          ...(corsoForm.edizione && { edizione: corsoForm.edizione }),
          ...(corsoForm.note && { note: corsoForm.note }),
          ...(corsoForm.location && { location: corsoForm.location }),
        }),
      })
      if (res.ok) {
        setAddCorsoOpen(false)
        resetAddCorso()
        router.refresh()
      }
    } finally {
      setSavingCorso(false)
    }
  }

  // ── Handlers: edit scuola ────────────────────────────────────
  const handleSaveScuola = async () => {
    setScuolaError('')
    setSavingScuola(true)
    try {
      const res = await fetch(`/api/progetti/${progetto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editScuolaForm),
      })
      const json = await res.json()
      if (!res.ok) { setScuolaError(json.error || 'Errore'); return }
      setEditScuolaOpen(false)

      const isTransitionToActive = progetto.status === 'pending' && editScuolaForm.status === 'active'
      const preAssegnati = corsi.filter(c => c.pre_assegnazione && c.formatore_id)
      if (isTransitionToActive && preAssegnati.length > 0) {
        setPreConfirmSelected(new Set(preAssegnati.map(c => c.id)))
        setPreConfirmOpen(true)
      } else {
        router.refresh()
      }
    } finally {
      setSavingScuola(false)
    }
  }

  // ── Handlers: notifica assegnazioni ──────────────────────────
  const handleSendNotifiche = async () => {
    setSendingNotifiche(true)
    setNotificaError('')
    try {
      const res = await fetch(`/api/progetti/${progetto.id}/notifica-assegnazioni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso_ids: Array.from(notificaSelected) }),
      })
      const json = await res.json()
      if (!res.ok) { setNotificaError(json.error || 'Errore'); return }
      setNotificaOpen(false)
      router.refresh()
    } finally {
      setSendingNotifiche(false)
    }
  }

  // ── Handlers: conferma pre-assegnazioni ──────────────────────
  const handleConfirmPreAssegnazioni = async () => {
    setConfirmingPre(true)
    try {
      const selected = Array.from(preConfirmSelected)
      if (selected.length > 0) {
        await fetch(`/api/progetti/${progetto.id}/conferma-pre-assegnazioni`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ corso_ids: selected }),
        })
      }
      setPreConfirmOpen(false)
      router.refresh()
    } finally {
      setConfirmingPre(false)
    }
  }

  // ── Handlers: referenti ──────────────────────────────────────
  const handleAddRef = async () => {
    setRefError('')
    setSavingRef(true)
    try {
      const res = await fetch('/api/referenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progetto_id: progetto.id, ...addRefForm }),
      })
      const json = await res.json()
      if (!res.ok) { setRefError(json.error || 'Errore'); return }
      setReferenti(prev => [...prev, json])
      setAddRefOpen(false)
      setAddRefForm(emptyReferenteForm)
    } finally {
      setSavingRef(false)
    }
  }

  const openEditRef = (r: Referente) => {
    setEditRef(r)
    setEditRefForm({ nome: r.nome, email: r.email, tel: r.tel || '', ruolo: r.ruolo || '' })
    setEditRefError('')
  }

  const handleSaveEditRef = async () => {
    if (!editRef) return
    setEditRefError('')
    setSavingEditRef(true)
    try {
      const res = await fetch(`/api/referenti/${editRef.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRefForm),
      })
      const json = await res.json()
      if (!res.ok) { setEditRefError(json.error || 'Errore'); return }
      setReferenti(prev => prev.map(r => r.id === json.id ? json : r))
      setEditRef(null)
    } finally {
      setSavingEditRef(false)
    }
  }

  const handleSaveMainRef = async () => {
    if (!editMainRefForm.nome.trim() || !editMainRefForm.email.trim()) return
    setMainRefError('')
    setSavingMainRef(true)
    try {
      const res = await fetch(`/api/progetti/${progetto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref_name: editMainRefForm.nome.trim(), ref_email: editMainRefForm.email.trim(), ref_tel: editMainRefForm.tel.trim(), ref_ruolo: editMainRefForm.ruolo || null }),
      })
      const json = await res.json()
      if (!res.ok) { setMainRefError(json.error || 'Errore'); return }
      setMainRef({ nome: json.ref_name, email: json.ref_email, tel: json.ref_tel || '', ruolo: json.ref_ruolo || '' })
      setEditMainRefOpen(false)
    } finally {
      setSavingMainRef(false)
    }
  }

  const handleDeleteRef = async (id: string) => {
    setDeletingRefId(id)
    try {
      await fetch(`/api/referenti/${id}`, { method: 'DELETE' })
      setReferenti(prev => prev.filter(r => r.id !== id))
    } finally {
      setDeletingRefId(null)
    }
  }

  // ── Helpers: cancellazione ──────────────────────────────────
  const isDeletable = (c: CorsoConOre) =>
    (oreErogatePerCorso[c.id] ?? 0) === 0 && !c.lettera_incarico_firmata && !c.corso_completato

  const nonDeletableReason = (c: CorsoConOre): string | null => {
    if ((oreErogatePerCorso[c.id] ?? 0) > 0) return 'Ha sessioni già erogate'
    if (c.lettera_incarico_firmata) return 'Ha lettera di incarico firmata'
    if (c.corso_completato) return 'Il corso è completato'
    return null
  }

  // ── Handlers: cancellazione massiva ─────────────────────────
  const handleBulkDelete = async () => {
    const toDelete = corsi.filter(c => deleteSelected.has(c.id) && isDeletable(c))
    if (toDelete.length === 0) return
    setDeletingBulk(true)
    setDeleteBulkError('')
    let errorMsg = ''
    for (const corso of toDelete) {
      const res = await fetch(`/api/corsi/${corso.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        errorMsg = json.error || "Errore durante l'eliminazione"
        break
      }
    }
    setDeletingBulk(false)
    if (errorMsg) { setDeleteBulkError(errorMsg); return }
    setDeleteBulkOpen(false)
    setDeleteSelected(new Set())
    setDeleteBulkConfirmText('')
    router.refresh()
  }

  // ── Handlers: aggiunta massiva corsi ────────────────────────
  const openBulkAddModal = () => {
    setBulkAddStep(1)
    setBulkAddSearch('')
    setBulkAddSelected(new Set())
    setBulkAddRows({})
    setSavingBulkAdd(false)
    setBulkAddProgress(null)
    setBulkAddResults(null)
    setBulkAddOpen(true)
  }

  const initBulkAddRows = () => {
    const rows: Record<string, BulkAddRow> = {}
    for (const id of bulkAddSelected) {
      const cat = catalogo.find(c => c.id === id)
      if (!cat) continue
      rows[id] = {
        catalogoId: id,
        title: cat.titolo,
        tipo: isDM38 ? 'MF' : cat.tipo,
        descrizione: cat.descrizione || '',
        link_scheda: cat.link_scheda || '',
        qty: 1,
        editions: [{
          ore_totali: isDM38 ? '30' : '',
          modalita: 'presenza',
          tutor_previsto: false,
          ore_tutoraggio: '',
          edizione: '',
          location: '',
        }],
      }
    }
    setBulkAddRows(rows)
    setBulkAddStep(2)
  }

  const handleBulkAddSave = async () => {
    // Flatten all editions across all rows into individual course-creation requests
    type SaveItem = { row: BulkAddRow; ed: BulkAddEdizione; label: string }
    const items: SaveItem[] = []
    for (const row of Object.values(bulkAddRows)) {
      for (const ed of row.editions) {
        const label = row.qty > 1 ? `${row.title} (${ed.edizione || '?'})` : row.title
        items.push({ row, ed, label })
      }
    }
    setSavingBulkAdd(true)
    setBulkAddProgress({ done: 0, total: items.length })
    const successi: string[] = []
    const errori: string[] = []
    for (let i = 0; i < items.length; i++) {
      const { row, ed, label } = items[i]
      try {
        const res = await fetch('/api/corsi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: progetto.id,
            title: row.title,
            tipo: row.tipo,
            ore_totali: Number(ed.ore_totali),
            modalita: ed.modalita || null,
            tutor_previsto: ed.tutor_previsto,
            ...(ed.tutor_previsto && ed.ore_tutoraggio ? { ore_tutoraggio: Number(ed.ore_tutoraggio) } : {}),
            ...(row.descrizione ? { descrizione: row.descrizione } : {}),
            ...(row.link_scheda ? { link_scheda: row.link_scheda } : {}),
            ...(ed.edizione ? { edizione: ed.edizione } : {}),
            ...(ed.location ? { location: ed.location } : {}),
          }),
        })
        if (res.ok) successi.push(label)
        else {
          const json = await res.json()
          errori.push(`${label}: ${json.error || 'Errore'}`)
        }
      } catch {
        errori.push(`${label}: Errore di rete`)
      }
      setBulkAddProgress({ done: i + 1, total: items.length })
    }
    setBulkAddResults({ successi, errori })
    setSavingBulkAdd(false)
    if (successi.length > 0) router.refresh()
  }

  // ── Handlers: assegnazione massiva ──────────────────────────
  const openBulkModal = () => {
    const newMap: Record<string, BulkRowState> = {}
    for (const c of corsi.filter(c => !c.formatore_id)) {
      newMap[c.id] = { formatoreId: '', tariffa: '' }
    }
    const existMap: Record<string, BulkRowState> = {}
    for (const c of corsi.filter(c => c.formatore_id)) {
      existMap[c.id] = {
        formatoreId: c.formatore_id as string,
        tariffa: c.tariffa_oraria != null ? String(c.tariffa_oraria) : '',
      }
    }
    setBulkFormMap(newMap)
    setExistingFormMap(existMap)
    setExistingExpanded(false)
    setBulkResults(null)
    setBulkProgress(null)
    setBulkValidationErrors(new Set())
    setBulkOpen(true)
  }

  const handleBulkFormatoreChange = (corsoId: string, formatoreId: string) => {
    const f = formatori.find(f => f.id === formatoreId)
    const tariffa = f?.tariffa_oraria_formatore != null ? String(f.tariffa_oraria_formatore) : ''
    setBulkFormMap(m => ({ ...m, [corsoId]: { formatoreId, tariffa } }))
    setBulkValidationErrors(e => { const n = new Set(e); n.delete(corsoId); return n })
  }

  const handleExistingFormatoreChange = (corsoId: string, formatoreId: string) => {
    const f = formatori.find(f => f.id === formatoreId)
    const existingCourse = corsi.find(c => c.id === corsoId)
    const tariffa = formatoreId !== existingCourse?.formatore_id
      ? (f?.tariffa_oraria_formatore != null ? String(f.tariffa_oraria_formatore) : (existingCourse?.tariffa_oraria != null ? String(existingCourse.tariffa_oraria) : ''))
      : (existingFormMap[corsoId]?.tariffa ?? '')
    setExistingFormMap(m => ({ ...m, [corsoId]: { formatoreId, tariffa } }))
  }

  const handleBulkTariffaChange = (corsoId: string, tariffa: string, isExisting: boolean) => {
    if (isExisting) {
      setExistingFormMap(m => ({ ...m, [corsoId]: { ...m[corsoId], tariffa } }))
    } else {
      setBulkFormMap(m => ({ ...m, [corsoId]: { ...m[corsoId], tariffa } }))
      setBulkValidationErrors(e => { const n = new Set(e); n.delete(corsoId); return n })
    }
  }

  const handleBulkSave = async () => {
    const toSave: Array<{ corsoId: string; title: string; formatoreId: string; tariffa: string }> = []
    for (const corso of corsi.filter(c => !c.formatore_id)) {
      const row = bulkFormMap[corso.id]
      if (row?.formatoreId) toSave.push({ corsoId: corso.id, title: corso.title, formatoreId: row.formatoreId, tariffa: row.tariffa })
    }
    for (const corso of corsi.filter(c => c.formatore_id)) {
      const row = existingFormMap[corso.id]
      if (row && row.formatoreId && row.formatoreId !== corso.formatore_id) {
        toSave.push({ corsoId: corso.id, title: corso.title, formatoreId: row.formatoreId, tariffa: row.tariffa })
      }
    }
    if (toSave.length === 0) return

    const missingTariffa = new Set<string>()
    for (const row of toSave) {
      if (!row.tariffa || Number(row.tariffa) <= 0) {
        const f = formatori.find(f => f.id === row.formatoreId)
        if (!f?.tariffa_oraria_formatore || f.tariffa_oraria_formatore <= 0) missingTariffa.add(row.corsoId)
      }
    }
    if (missingTariffa.size > 0) { setBulkValidationErrors(missingTariffa); return }

    setBulkSaving(true)
    setBulkProgress({ done: 0, total: toSave.length })
    const successi: string[] = []
    const errori: { corso: string; err: string }[] = []

    for (let i = 0; i < toSave.length; i++) {
      const { corsoId, title, formatoreId, tariffa } = toSave[i]
      const body: Record<string, unknown> = { formatore_id: formatoreId }
      if (tariffa && Number(tariffa) > 0) body.tariffa_oraria = Number(tariffa)
      const res = await fetch(`/api/corsi/${corsoId}/formatore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (res.ok) successi.push(title)
      else errori.push({ corso: title, err: json.message || json.error || 'Errore sconosciuto' })
      setBulkProgress({ done: i + 1, total: toSave.length })
    }

    setBulkSaving(false)
    setBulkResults({ successi, errori })
    if (successi.length > 0) router.refresh()
  }

  // ── Handlers: chat ───────────────────────────────────────────
  const handleSendMsg = async () => {
    if (!newMsg.trim()) return
    setSendingMsg(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progetto_id: progetto.id, testo: newMsg.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessaggi(prev => [...prev, data])
        setNewMsg('')
      }
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/progetti" className="hover:text-gray-700">Progetti</Link>
        <span>/</span>
        <span className="text-gray-700">{progetto.school_name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{progetto.school_name}</h1>
              <StatusBadge variant={progetto.status} />
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-0.5">
              <p className="text-sm text-gray-500">{formatAddress(progetto)}</p>
              {(() => {
                const finId = (progetto as ProgettoConStats & { finanziamento_id?: string | null }).finanziamento_id
                const fin = finId ? finanziamenti.find(f => f.id === finId) : null
                if (fin) {
                  const color = getFinanziamentoColor(fin.nome)
                  return (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: color.bg, color: color.text }}>
                      {fin.nome}
                    </span>
                  )
                }
                if (progetto.anno_scolastico) return <span className="text-sm text-gray-400">{progetto.anno_scolastico}</span>
                return null
              })()}
              {progetto.partner_id && (() => {
                const partner = partners.find(p => p.id === progetto.partner_id)
                if (!partner) return null
                return (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {partner.nome}
                  </span>
                )
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditScuolaForm({
                  school_name: progetto.school_name,
                  address: progetto.address,
                  anno_scolastico: progetto.anno_scolastico || '',
                  finanziamento_id: (progetto as ProgettoConStats & { finanziamento_id?: string | null }).finanziamento_id || '',
                  partner_id: progetto.partner_id || '',
                  quota_progettazione: String(progetto.quota_progettazione ?? ''),
                  quota_progettazione_note: progetto.quota_progettazione_note ?? '',
                  status: progetto.status,
                  regione: progetto.regione ?? '',
                  provincia: progetto.provincia ?? '',
                  citta: progetto.citta ?? '',
                })
                setEditScuolaOpen(true)
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Modifica
            </Button>
            {isSuperAdmin && (
              <button
                onClick={() => setDeleteProgettoOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-[7px] transition-colors"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Elimina
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">REFERENTE PRINCIPALE</div>
            <div className="font-medium text-sm text-gray-800">{progetto.ref_name}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">EMAIL</div>
            <a href={`mailto:${progetto.ref_email}`} className="text-sm text-blue-600 hover:underline">{progetto.ref_email}</a>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">TELEFONO</div>
            {progetto.ref_tel
              ? <a href={`tel:${telHref(progetto.ref_tel)}`} className="text-sm text-blue-600 hover:underline">{progetto.ref_tel}</a>
              : <div className="text-sm text-gray-800">—</div>
            }
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-500 mb-2">Progresso ore complessive</div>
          <DualProgressBar
            oreTotali={Number(progetto.ore_totali)}
            orePianificate={Number(progetto.ore_pianificate)}
            oreErogate={Object.values(oreErogatePerCorso).reduce((s, x) => s + x, 0)}
            size="lg"
          />
        </div>
      </div>

      {/* Alert */}
      {(Number(progetto.corsi_senza_formatore) > 0 || Number(progetto.corsi_senza_calendario) > 0) && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="text-amber-500 shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="text-sm text-amber-800">
            {Number(progetto.corsi_senza_formatore) > 0 && (
              <div>{progetto.corsi_senza_formatore} cors{Number(progetto.corsi_senza_formatore) > 1 ? 'i' : 'o'} senza formatore assegnato.</div>
            )}
            {Number(progetto.corsi_senza_calendario) > 0 && (
              <div>{progetto.corsi_senza_calendario} cors{Number(progetto.corsi_senza_calendario) > 1 ? 'i' : 'o'} con formatore ma senza calendario completo.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Sezione quota progettazione ── */}
      {(() => {
        const quotaProg = Number(progetto.quota_progettazione ?? 0)
        if (!quotaProg) return null
        const ivaQuota = quotaProg * 0.22
        return (
          <div className="bg-white rounded-xl mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" className="text-blue-500 shrink-0">
                <path d="M9 14l6-6M9 9h.01M15 15h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="font-semibold text-gray-900">Quota progettazione</h2>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-2 max-w-xs">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Imponibile (ricavo SVC)</span>
                  <span className="font-mono font-semibold text-blue-700">{fmtCur(quotaProg)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>IVA 22% — versata dalla scuola all&apos;Erario (Split Payment)</span>
                  <span className="font-mono">{fmtCur(ivaQuota)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Totale documento</span>
                  <span className="font-mono">{fmtCur(quotaProg + ivaQuota)}</span>
                </div>
                {progetto.quota_progettazione_note && (
                  <p className="text-xs text-gray-400 pt-1">{progetto.quota_progettazione_note}</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Sezione commissione partner ── */}
      {progetto.partner_id && (() => {
        const partner = partners.find(p => p.id === progetto.partner_id)
        if (!partner) return null
        const finId = (progetto as ProgettoConStats & { finanziamento_id?: string | null }).finanziamento_id
        const fin = finId ? finanziamenti.find(f => f.id === finId) : null
        const tariffaF = Number(fin?.tariffa_formatore_ora ?? 0)
        const tariffaT = Number(fin?.tariffa_tutor_ora ?? 0)
        const quotaProg = Number(progetto.quota_progettazione ?? 0)

        let fatturatoCorsiFull = 0
        let fatturatoCorsiAttuali = 0
        for (const c of corsi) {
          const oreTotali = Number(c.ore_totali ?? 0)
          const oreErogate = oreErogatePerCorso[c.id] ?? 0
          const hasRealTutor = c.tipo === 'PF' && !!c.tutor_id
          const oreTutor = hasRealTutor ? Number((c as CorsoConOre & { ore_tutoraggio?: number }).ore_tutoraggio ?? 0) : 0
          fatturatoCorsiFull += oreTotali * tariffaF + oreTutor * tariffaT
          if (c.corso_completato) {
            fatturatoCorsiAttuali += oreErogate * tariffaF + oreTutor * tariffaT
          }
        }
        const fatturatoAttuale = fatturatoCorsiAttuali + quotaProg
        const fatturatoPotenziale = fatturatoCorsiFull + quotaProg
        const commAttuale = calcCommissionePartner(fatturatoAttuale)
        const commPotenziale = calcCommissionePartner(fatturatoPotenziale)
        const hasTariffe = tariffaF > 0

        return (
          <div className="bg-white rounded-xl mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" className="text-violet-500 shrink-0">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="font-semibold text-gray-900">Commissione partner</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">{partner.nome}</span>
            </div>
            <div className="px-6 py-4">
              {!hasTariffe ? (
                <p className="text-sm text-gray-400">Nessuna tariffa scuola configurata per questo finanziamento — impossibile calcolare la commissione.</p>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Attuale (corsi completati)</div>
                    {quotaProg > 0 && (
                      <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                        <div>Base di calcolo:</div>
                        <div className="font-mono">Corsi {fmtCur(fatturatoCorsiAttuali)} + Quota {fmtCur(quotaProg)} = {fmtCur(fatturatoAttuale)}</div>
                      </div>
                    )}
                    <div className="text-sm text-gray-500 mb-0.5">Fatturato scuola</div>
                    <div className="font-mono font-semibold text-gray-800 text-base">{fmtCur(fatturatoAttuale)}</div>
                    <div className="text-sm text-gray-500 mt-3 mb-0.5">Commissione maturata</div>
                    <div className="font-mono text-violet-600">{fmtCur(commAttuale.commissione)}</div>
                    <div className="text-sm text-gray-500 mt-1 mb-0.5">IVA 22%</div>
                    <div className="font-mono text-violet-500">{fmtCur(commAttuale.iva)}</div>
                    <div className="text-sm text-gray-500 mt-1 mb-0.5">Totale da riconoscere</div>
                    <div className="font-mono font-bold text-violet-700 text-lg">{fmtCur(commAttuale.totale)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fatturatoAttuale <= 100000 ? '10% flat' : '10% su primi €100k + 12% sull\'eccedenza'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Potenziale (tutti i corsi)</div>
                    {quotaProg > 0 && (
                      <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                        <div>Base di calcolo:</div>
                        <div className="font-mono">Corsi {fmtCur(fatturatoCorsiFull)} + Quota {fmtCur(quotaProg)} = {fmtCur(fatturatoPotenziale)}</div>
                      </div>
                    )}
                    <div className="text-sm text-gray-500 mb-0.5">Fatturato scuola</div>
                    <div className="font-mono font-semibold text-gray-600 text-base">{fmtCur(fatturatoPotenziale)}</div>
                    <div className="text-sm text-gray-500 mt-3 mb-0.5">Commissione potenziale</div>
                    <div className="font-mono text-violet-400">{fmtCur(commPotenziale.commissione)}</div>
                    <div className="text-sm text-gray-500 mt-1 mb-0.5">IVA 22%</div>
                    <div className="font-mono text-violet-300">{fmtCur(commPotenziale.iva)}</div>
                    <div className="text-sm text-gray-500 mt-1 mb-0.5">Totale da riconoscere</div>
                    <div className="font-mono font-bold text-violet-400 text-lg">{fmtCur(commPotenziale.totale)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fatturatoPotenziale <= 100000 ? '10% flat' : '10% su primi €100k + 12% sull\'eccedenza'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Referenti */}
      <div className="bg-white rounded-xl mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Referenti</h2>
          <Button size="sm" onClick={() => { setAddRefForm(emptyReferenteForm); setRefError(''); setAddRefOpen(true) }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Aggiungi referente
          </Button>
        </div>
        <div className="divide-y divide-gray-50">
          {/* Referente principale (from progetti) — always first */}
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{mainRef.nome}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">Principale</span>
                <RuoloBadge ruolo={mainRef.ruolo} />
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                <a href={`mailto:${mainRef.email}`} className="hover:text-blue-600">{mainRef.email}</a>
                {mainRef.tel && <a href={`tel:${telHref(mainRef.tel)}`} className="hover:text-blue-600">{mainRef.tel}</a>}
              </div>
            </div>
            <button
              onClick={() => { setEditMainRefForm({ nome: mainRef.nome, email: mainRef.email, tel: mainRef.tel, ruolo: mainRef.ruolo }); setMainRefError(''); setEditMainRefOpen(true) }}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 shrink-0"
              title="Modifica referente principale"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                <path d="M19.5 7.125L16.875 4.5"/>
              </svg>
            </button>
          </div>
          {/* Additional referenti */}
          {referenti.map(r => (
            <div key={r.id} className="px-6 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">{r.nome}<RuoloBadge ruolo={r.ruolo} /></div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                  <a href={`mailto:${r.email}`} className="hover:text-blue-600">{r.email}</a>
                  {r.tel && <a href={`tel:${telHref(r.tel)}`} className="hover:text-blue-600">{r.tel}</a>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEditRef(r)}
                  className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Modifica
                </button>
                <button
                  onClick={() => handleDeleteRef(r.id)}
                  disabled={deletingRefId === r.id}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingRefId === r.id ? '...' : 'Rimuovi'}
                </button>
              </div>
            </div>
          ))}
          {referenti.length === 0 && (
            <div className="px-6 py-4 text-sm text-gray-400">
              Nessun referente aggiuntivo. Il referente principale è il contatto di default.
            </div>
          )}
        </div>
      </div>

      {/* Corsi */}
      <div className="bg-white rounded-xl mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-gray-900">Corsi ({corsi.length})</h2>
            {corsi.filter(c => !!c.formatore_id && (!c.notificato || c.stato_assegnazione === 'in_attesa') && !['accettato', 'rifiutato', 'pre_accettato', 'pre_rifiutato'].includes(c.stato_assegnazione ?? '')).length > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {corsi.filter(c => !!c.formatore_id && (!c.notificato || c.stato_assegnazione === 'in_attesa') && !['accettato', 'rifiutato', 'pre_accettato', 'pre_rifiutato'].includes(c.stato_assegnazione ?? '')).length} da notificare
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {corsi.filter(c => !!c.formatore_id && (!c.notificato || c.stato_assegnazione === 'in_attesa') && !['accettato', 'rifiutato', 'pre_accettato', 'pre_rifiutato'].includes(c.stato_assegnazione ?? '')).length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const daNotificare = corsi.filter(c => !!c.formatore_id && (!c.notificato || c.stato_assegnazione === 'in_attesa') && !['accettato', 'rifiutato', 'pre_accettato', 'pre_rifiutato'].includes(c.stato_assegnazione ?? ''))
                  setNotificaSelected(new Set(daNotificare.map(c => c.id)))
                  setNotificaError('')
                  setNotificaOpen(true)
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Invia notifiche
              </Button>
            )}
            {corsi.filter(c => !c.formatore_id).length > 0 && (
              <Button size="sm" variant="secondary" onClick={openBulkModal}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Assegnazione massiva
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={openBulkAddModal}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M16 17h6M19 14v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Aggiungi più corsi
            </Button>
            <Button size="sm" onClick={() => setAddCorsoOpen(true)}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Aggiungi Corso
            </Button>
          </div>
        </div>
        {deleteSelected.size > 0 && (
          <div className="px-6 pt-3 pb-0">
            <button
              onClick={() => { setDeleteBulkError(''); setDeleteBulkConfirmText(''); setDeleteBulkOpen(true) }}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-[7px] transition-colors"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Elimina selezionati ({deleteSelected.size})
            </button>
          </div>
        )}
        <div className="divide-y divide-gray-50">
          {corsi.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Nessun corso aggiunto. Clicca &quot;Aggiungi Corso&quot; per iniziare.
            </div>
          ) : (
            corsi.map(corso => (
              <CourseRow
                key={corso.id}
                corso={corso}
                progettoId={progetto.id}
                oreErogate={oreErogatePerCorso[corso.id] ?? 0}
                finanziamentoNome={progettoFinanziamentoNome}
                selected={deleteSelected.has(corso.id)}
                onToggle={id => setDeleteSelected(prev => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id); else next.add(id)
                  return next
                })}
                deletable={isDeletable(corso)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="text-gray-400">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h2 className="font-semibold text-gray-900">Chat progetto</h2>
          <span className="text-xs text-gray-400 ml-auto">{messaggi.length} messagg{messaggi.length === 1 ? 'io' : 'i'}</span>
        </div>
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {messaggi.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nessun messaggio ancora. Inizia la conversazione!</p>
          ) : (
            messaggi.map(m => {
              const isMe = m.autore_id === currentUserId
              return (
                <div key={m.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {m.autore && <Avatar nome={m.autore.nome} id={m.autore.id} initials={m.autore.avatar_initials} size="sm" />}
                  <div className={`max-w-xs flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {!isMe && <span className="text-xs font-medium text-gray-700">{m.autore?.nome}</span>}
                      <span className="text-xs text-gray-400">{formatDate(m.created_at)}</span>
                    </div>
                    <div
                      className={`text-sm px-3 py-2 rounded-xl break-words ${isMe ? 'text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}
                      style={isMe ? { backgroundColor: '#d64b55' } : {}}
                    >
                      {m.testo}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={chatBottomRef} />
        </div>
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMsg() } }}
              placeholder="Scrivi un messaggio..."
              className="flex-1 text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors"
            />
            <Button size="sm" onClick={handleSendMsg} loading={sendingMsg} disabled={!newMsg.trim()}>Invia</Button>
          </div>
        </div>
      </div>

      {/* Valutazioni questionari */}
      {questionari.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-bold text-gray-900">Valutazioni questionari</h2>
            <span className="text-sm text-gray-400">· tutti i corsi del progetto</span>
          </div>
          <QuestionariBlock questionari={questionari} showTexts showStorico />
        </div>
      )}

      {/* ── Modal: Modifica dati scuola ─────────────────────────────── */}
      <Modal
        open={editScuolaOpen}
        onClose={() => setEditScuolaOpen(false)}
        title="Modifica dati scuola"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditScuolaOpen(false)}>Annulla</Button>
            <Button
              onClick={handleSaveScuola}
              loading={savingScuola}
              disabled={!editScuolaForm.school_name.trim()}
            >
              Salva modifiche
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome scuola *"
            value={editScuolaForm.school_name}
            onChange={e => setEditScuolaForm(f => ({ ...f, school_name: e.target.value }))}
          />
          <Input
            label="Via e civico"
            value={editScuolaForm.address}
            onChange={e => setEditScuolaForm(f => ({ ...f, address: e.target.value }))}
          />
          <GeoSelect
            regione={editScuolaForm.regione}
            provincia={editScuolaForm.provincia}
            citta={editScuolaForm.citta}
            onRegioneChange={v => setEditScuolaForm(f => ({ ...f, regione: v }))}
            onProvinciaChange={v => setEditScuolaForm(f => ({ ...f, provincia: v }))}
            onCittaChange={v => setEditScuolaForm(f => ({ ...f, citta: v }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Finanziamento</label>
            <select
              value={editScuolaForm.finanziamento_id}
              onChange={e => setEditScuolaForm(f => ({ ...f, finanziamento_id: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 bg-white focus:outline-none focus:border-[#d64b55] transition-colors"
            >
              <option value="">Nessun finanziamento</option>
              {finanziamenti.filter(f => f.attivo || f.id === editScuolaForm.finanziamento_id).map(f => (
                <option key={f.id} value={f.id}>{f.nome}{!f.attivo ? ' (inattivo)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Partner</label>
            <select
              value={editScuolaForm.partner_id}
              onChange={e => setEditScuolaForm(f => ({ ...f, partner_id: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 bg-white focus:outline-none focus:border-[#d64b55] transition-colors"
            >
              <option value="">Nessun partner</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <Input
              label="Quota progettazione (€)"
              type="number"
              value={editScuolaForm.quota_progettazione}
              onChange={e => setEditScuolaForm(f => ({ ...f, quota_progettazione: e.target.value }))}
              placeholder="es. 1000.00"
            />
            <p className="text-xs text-gray-400 mt-1">Importo fisso fatturato da SVC alla scuola (min €500 max €1.500). Soggetto a split payment IVA 22%.</p>
          </div>
          <Input
            label="Note quota progettazione"
            value={editScuolaForm.quota_progettazione_note}
            onChange={e => setEditScuolaForm(f => ({ ...f, quota_progettazione_note: e.target.value }))}
            placeholder="es. Compenso per progettazione didattica"
          />
          <Select
            label="Stato *"
            value={editScuolaForm.status}
            onChange={e => setEditScuolaForm(f => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'active', label: 'Attivo' },
              { value: 'pending', label: 'In attesa' },
              { value: 'completed', label: 'Completato' },
            ]}
          />
          {scuolaError && (
            <p className="text-sm text-red-600">{scuolaError}</p>
          )}
        </div>
      </Modal>

      {/* ── Modal: Aggiungi referente ───────────────────────────────── */}
      <Modal
        open={addRefOpen}
        onClose={() => setAddRefOpen(false)}
        title="Aggiungi referente"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddRefOpen(false)}>Annulla</Button>
            <Button
              onClick={handleAddRef}
              loading={savingRef}
              disabled={!addRefForm.nome.trim() || !addRefForm.email.trim()}
            >
              Aggiungi
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nome *" value={addRefForm.nome} onChange={e => setAddRefForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Prof. Mario Rossi" />
          <Input label="Email *" type="email" value={addRefForm.email} onChange={e => setAddRefForm(f => ({ ...f, email: e.target.value }))} placeholder="mario.rossi@scuola.it" />
          <Input label="Telefono" value={addRefForm.tel} onChange={e => setAddRefForm(f => ({ ...f, tel: e.target.value }))} placeholder="Es. 02-12345678" />
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label><select value={addRefForm.ruolo} onChange={e => setAddRefForm(f => ({ ...f, ruolo: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">— Seleziona ruolo —</option>{RUOLI_REFERENTE.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          {refError && <p className="text-sm text-red-600">{refError}</p>}
        </div>
      </Modal>

      {/* ── Modal: Modifica referente ───────────────────────────────── */}
      <Modal
        open={!!editRef}
        onClose={() => setEditRef(null)}
        title="Modifica referente"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditRef(null)}>Annulla</Button>
            <Button
              onClick={handleSaveEditRef}
              loading={savingEditRef}
              disabled={!editRefForm.nome.trim() || !editRefForm.email.trim()}
            >
              Salva
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nome *" value={editRefForm.nome} onChange={e => setEditRefForm(f => ({ ...f, nome: e.target.value }))} />
          <Input label="Email *" type="email" value={editRefForm.email} onChange={e => setEditRefForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Telefono" value={editRefForm.tel} onChange={e => setEditRefForm(f => ({ ...f, tel: e.target.value }))} />
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label><select value={editRefForm.ruolo} onChange={e => setEditRefForm(f => ({ ...f, ruolo: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">— Seleziona ruolo —</option>{RUOLI_REFERENTE.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          {editRefError && <p className="text-sm text-red-600">{editRefError}</p>}
        </div>
      </Modal>

      {/* ── Modal: Modifica referente principale ────────────────── */}
      <Modal
        open={editMainRefOpen}
        onClose={() => setEditMainRefOpen(false)}
        title="Modifica referente principale"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditMainRefOpen(false)}>Annulla</Button>
            <Button
              onClick={handleSaveMainRef}
              loading={savingMainRef}
              disabled={!editMainRefForm.nome.trim() || !editMainRefForm.email.trim()}
            >
              Salva
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nome *" value={editMainRefForm.nome} onChange={e => setEditMainRefForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Prof. Mario Rossi" />
          <Input label="Email *" type="email" value={editMainRefForm.email} onChange={e => setEditMainRefForm(f => ({ ...f, email: e.target.value }))} placeholder="mario.rossi@scuola.it" />
          <Input label="Telefono" value={editMainRefForm.tel} onChange={e => setEditMainRefForm(f => ({ ...f, tel: e.target.value }))} placeholder="Es. 02-12345678" />
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label><select value={editMainRefForm.ruolo} onChange={e => setEditMainRefForm(f => ({ ...f, ruolo: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">— Seleziona ruolo —</option>{RUOLI_REFERENTE.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          {mainRefError && <p className="text-sm text-red-600">{mainRefError}</p>}
        </div>
      </Modal>

      {/* ── Modal: Invia notifiche assegnazioni ─────────────────────── */}
      <Modal
        open={notificaOpen}
        onClose={() => setNotificaOpen(false)}
        title="Invia notifiche assegnazioni"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNotificaOpen(false)}>Annulla</Button>
            <Button
              onClick={handleSendNotifiche}
              loading={sendingNotifiche}
              disabled={notificaSelected.size === 0}
            >
              Invia notifiche selezionate ({notificaSelected.size})
            </Button>
          </>
        }
      >
        <div className="space-y-1">
          <p className="text-sm text-gray-500 mb-4">
            Verrà inviata un&apos;unica email riepilogativa per ogni formatore con i corsi selezionati.
          </p>
          {(() => {
            const daNotificare = corsi.filter(c =>
              !!c.formatore_id &&
              (!c.notificato || c.stato_assegnazione === 'in_attesa') &&
              !['accettato', 'rifiutato', 'pre_accettato', 'pre_rifiutato'].includes(c.stato_assegnazione ?? '')
            )
            if (daNotificare.length === 0) {
              return (
                <p className="text-sm text-gray-500 text-center py-6">
                  Tutti i corsi hanno già ricevuto una risposta dal formatore.
                </p>
              )
            }
            const byFormatore = new Map<string, typeof daNotificare>()
            for (const c of daNotificare) {
              const fId = c.formatore_id as string
              if (!byFormatore.has(fId)) byFormatore.set(fId, [])
              byFormatore.get(fId)!.push(c)
            }
            return Array.from(byFormatore.entries()).map(([fId, fCorsi]) => {
              const formatore = (fCorsi[0].formatore as { nome?: string } | undefined)
              const preCorsi = fCorsi.filter(c => c.pre_assegnazione)
              const defCorsi = fCorsi.filter(c => !c.pre_assegnazione)
              return (
                <div key={fId} className="border border-gray-100 rounded-[7px] overflow-hidden mb-3">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{formatore?.nome || 'Formatore'}</span>
                    <button
                      className="text-xs text-gray-400 hover:text-gray-600"
                      onClick={() => {
                        const allIds = fCorsi.map(c => c.id)
                        const allSelected = allIds.every(id => notificaSelected.has(id))
                        setNotificaSelected(prev => {
                          const next = new Set(prev)
                          if (allSelected) allIds.forEach(id => next.delete(id))
                          else allIds.forEach(id => next.add(id))
                          return next
                        })
                      }}
                    >
                      {fCorsi.every(c => notificaSelected.has(c.id)) ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    </button>
                  </div>
                  <div className="px-4 py-2">
                    {preCorsi.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1.5">Pre-assegnazioni</div>
                        {preCorsi.map(c => (
                          <label key={c.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificaSelected.has(c.id)}
                              onChange={e => {
                                setNotificaSelected(prev => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(c.id)
                                  else next.delete(c.id)
                                  return next
                                })
                              }}
                              className="w-4 h-4 rounded accent-[#d64b55]"
                            />
                            <span className="text-sm text-gray-700 flex-1">{c.title}</span>
                            <span className="text-xs text-gray-400">{c.ore_totali}h</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {defCorsi.length > 0 && (
                      <div className={preCorsi.length > 0 ? 'pt-2 border-t border-gray-50' : ''}>
                        {preCorsi.length > 0 && (
                          <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1.5">Assegnazioni definitive</div>
                        )}
                        {defCorsi.map(c => (
                          <label key={c.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificaSelected.has(c.id)}
                              onChange={e => {
                                setNotificaSelected(prev => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(c.id)
                                  else next.delete(c.id)
                                  return next
                                })
                              }}
                              className="w-4 h-4 rounded accent-[#d64b55]"
                            />
                            <span className="text-sm text-gray-700 flex-1">{c.title}</span>
                            <span className="text-xs text-gray-400">{c.ore_totali}h</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          })()}
          {notificaError && <p className="text-sm text-red-600 pt-2">{notificaError}</p>}
        </div>
      </Modal>

      {/* ── Modal: Conferma pre-assegnazioni ─────────────────────────── */}
      <Modal
        open={preConfirmOpen}
        onClose={() => { setPreConfirmOpen(false); router.refresh() }}
        title="Conferma pre-assegnazioni"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setPreConfirmOpen(false); router.refresh() }}
            >
              Salta per ora
            </Button>
            <Button
              onClick={handleConfirmPreAssegnazioni}
              loading={confirmingPre}
              disabled={preConfirmSelected.size === 0}
            >
              Conferma selezionate ({preConfirmSelected.size})
            </Button>
          </>
        }
      >
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Il progetto è passato ad <strong>Attivo</strong>. I corsi seguenti erano in pre-assegnazione.
            Seleziona quelli da confermare come assegnazioni definitive (notificato = no, per consentire il re-invio):
          </p>
          <div className="space-y-1">
            {corsi.filter(c => c.pre_assegnazione && c.formatore_id).map(c => {
              const formatore = c.formatore as { nome?: string } | undefined
              return (
                <label key={c.id} className="flex items-center gap-2.5 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preConfirmSelected.has(c.id)}
                    onChange={e => {
                      setPreConfirmSelected(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(c.id)
                        else next.delete(c.id)
                        return next
                      })
                    }}
                    className="w-4 h-4 rounded accent-[#d64b55]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700">{c.title}</div>
                    {formatore?.nome && <div className="text-xs text-gray-400">{formatore.nome}</div>}
                  </div>
                  <span className="text-xs text-gray-400">{c.ore_totali}h</span>
                </label>
              )
            })}
          </div>
        </div>
      </Modal>

      <DeleteConfirmModal
        open={deleteProgettoOpen}
        onClose={() => setDeleteProgettoOpen(false)}
        title={`Elimina progetto — ${progetto.school_name}`}
        description={`Sei sicuro di voler eliminare il progetto di ${progetto.school_name}? Questa azione è irreversibile. Tutti i corsi, sessioni e messaggi correlati verranno eliminati definitivamente.`}
        confirmName="CANCELLA"
        onConfirm={async () => {
          const res = await fetch(`/api/progetti/${progetto.id}`, { method: 'DELETE' })
          if (!res.ok) {
            const json = await res.json()
            throw new Error(json.error || 'Errore durante l\'eliminazione')
          }
          router.push('/progetti')
        }}
      />

      {/* ── Modal: Aggiungi corso ────────────────────────────────────── */}
      <Modal
        open={addCorsoOpen}
        onClose={() => { setAddCorsoOpen(false); resetAddCorso() }}
        title={addCorsoStep === 1 ? 'Aggiungi Corso — Scegli dal catalogo' : 'Aggiungi Corso — Configura'}
        footer={
          addCorsoStep === 1 ? (
            <>
              <Button variant="secondary" onClick={() => { setAddCorsoOpen(false); resetAddCorso() }}>Annulla</Button>
              <Button variant="secondary" onClick={() => setAddCorsoStep(2)}>
                Crea manuale
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setAddCorsoStep(1)}>← Indietro</Button>
              <Button
                onClick={handleAddCorso}
                loading={savingCorso}
                disabled={!corsoForm.title || !corsoForm.ore_totali || (corsoForm.tipo === 'PF' && !corsoForm.modalita) || (corsoForm.tutor_previsto && !corsoForm.tutor_nome) || (['residenziale', 'semi_residenziale'].includes(corsoForm.modalita) && !corsoForm.location.trim())}
              >
                Aggiungi corso
              </Button>
            </>
          )
        }
      >
        {addCorsoStep === 1 ? (
          <div className="space-y-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" fill="none" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={catalogoSearch}
                onChange={e => setCatalogoSearch(e.target.value)}
                placeholder="Cerca nel catalogo…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors"
              />
            </div>
            <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-[7px] divide-y divide-gray-50">
              {catalogo
                .filter(c => {
                  if (!c.attivo) return false
                  // Filter by finanziamento: DM38 project sees only DM38 catalog items;
                  // other projects see items with no finanziamento or matching finanziamento.
                  if (isDM38) {
                    if (c.finanziamento_id !== progetto.finanziamento_id) return false
                  } else {
                    if (c.finanziamento_id && c.finanziamento_id !== (progetto.finanziamento_id ?? null)) return false
                  }
                  if (catalogoSearch.trim()) {
                    const q = catalogoSearch.trim().toLowerCase()
                    return c.titolo.toLowerCase().includes(q) || !!c.descrizione?.toLowerCase().includes(q)
                  }
                  return true
                })
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectFromCatalogo(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{c.titolo}</span>
                      <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${c.tipo === 'PF' ? 'bg-blue-100 text-blue-700' : c.tipo === 'MF' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                        {c.tipo}
                      </span>
                    </div>
                    {c.descrizione && <p className="text-xs text-gray-400 truncate">{c.descrizione}</p>}
                  </button>
                ))}
              {catalogo.filter(c => c.attivo).length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400 text-center">
                  Nessun corso attivo nel catalogo.
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400">Oppure clicca &quot;Crea manuale&quot; per configurare il corso senza partire dal catalogo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {isDM38 && (
              <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-[7px] px-3 py-2">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Progetto DM 38/2026 — Moduli formativi: tariffe auto-popolate (€{progettoFinanziamento?.tariffa_formatore_ora ?? 70}/h formatore, €{progettoFinanziamento?.tariffa_tutor_ora ?? 30}/h tutor)
              </div>
            )}
            <Input label="Titolo corso *" value={corsoForm.title} onChange={e => setCorsoForm(f => ({ ...f, title: e.target.value }))} placeholder="Es. Sicurezza sul lavoro" />
            <div className="grid grid-cols-2 gap-3">
              {isDM38 ? (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1.5">Tipo</div>
                  <div className="text-sm text-gray-500 px-3 py-2 border border-gray-100 rounded-[7px] bg-gray-50">
                    Modulo Formativo (MF)
                  </div>
                </div>
              ) : (
                <Select
                  label="Tipo *"
                  value={corsoForm.tipo}
                  onChange={e => setCorsoForm(f => {
                    const newTipo = e.target.value
                    const shouldReset = newTipo === 'Lab' && ['online', 'ibrido'].includes(f.modalita)
                    return { ...f, tipo: newTipo, modalita: shouldReset ? 'presenza' : (f.modalita || 'presenza'), location: shouldReset ? '' : f.location }
                  })}
                  options={[
                    { value: 'PF', label: 'Percorso Formativo (PF)' },
                    { value: 'Lab', label: 'Laboratorio sul Campo (Lab)' },
                  ]}
                />
              )}
              {isDM38 ? (
                <Select
                  label="Ore totali *"
                  value={corsoForm.ore_totali}
                  onChange={e => setCorsoForm(f => ({ ...f, ore_totali: e.target.value }))}
                  options={[
                    { value: '30', label: '30 ore' },
                    { value: '60', label: '60 ore' },
                  ]}
                />
              ) : (
                <Input label="Ore totali *" type="number" min={1} value={corsoForm.ore_totali} onChange={e => setCorsoForm(f => ({ ...f, ore_totali: e.target.value }))} placeholder="Es. 20" />
              )}
            </div>
            <Select
              label={`Modalità erogazione${corsoForm.tipo === 'PF' ? ' *' : ''}`}
              value={corsoForm.modalita}
              onChange={e => setCorsoForm(f => ({ ...f, modalita: e.target.value, location: ['residenziale', 'semi_residenziale'].includes(e.target.value) ? f.location : '' }))}
              options={corsoForm.tipo === 'Lab' ? [
                { value: 'presenza', label: 'In presenza' },
                { value: 'residenziale', label: 'Residenziale' },
                { value: 'semi_residenziale', label: 'Semi-residenziale' },
              ] : [
                { value: 'presenza', label: 'In presenza' },
                { value: 'online', label: 'Online' },
                { value: 'ibrido', label: 'Ibrido (presenza + online)' },
                { value: 'residenziale', label: 'Residenziale' },
                { value: 'semi_residenziale', label: 'Semi-residenziale' },
              ]}
            />
            {['residenziale', 'semi_residenziale'].includes(corsoForm.modalita) && (
              <Input
                label="Location *"
                value={corsoForm.location}
                onChange={e => setCorsoForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Nome struttura, indirizzo..."
              />
            )}
            {(corsoForm.tipo === 'PF' || corsoForm.tipo === 'MF') && (
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={corsoForm.tutor_previsto}
                    onChange={e => setCorsoForm(f => ({ ...f, tutor_previsto: e.target.checked, tutor_nome: '', ore_tutoraggio: '' }))}
                    className="w-4 h-4 rounded accent-[#d64b55]"
                  />
                  <span className="text-sm font-medium text-gray-700">È previsto un tutor?</span>
                </label>
                {corsoForm.tutor_previsto && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <Input label="Nome tutor *" value={corsoForm.tutor_nome} onChange={e => setCorsoForm(f => ({ ...f, tutor_nome: e.target.value }))} placeholder="Es. Anna Verdi" />
                    <Input label="Ore tutoraggio" type="number" min={1} value={corsoForm.ore_tutoraggio} onChange={e => setCorsoForm(f => ({ ...f, ore_tutoraggio: e.target.value }))} placeholder="Es. 10" />
                  </div>
                )}
              </div>
            )}
            <Input label="Edizione" value={corsoForm.edizione} onChange={e => setCorsoForm(f => ({ ...f, edizione: e.target.value }))} placeholder="Es. 2024-2025" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
              <textarea
                value={corsoForm.note}
                onChange={e => setCorsoForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Note aggiuntive sul corso..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Assegnazione massiva formatori ────────────────── */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8" style={{ border: '0.5px solid #e5e5e5' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Assegnazione massiva formatori</h2>
              {!bulkSaving && (
                <button
                  onClick={() => setBulkOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {bulkResults ? (
                <div className="space-y-4">
                  {bulkResults.successi.length > 0 && (
                    <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-[7px]">
                      <span className="text-green-600 mt-0.5">✅</span>
                      <div>
                        <div className="text-sm font-medium text-green-800">
                          {bulkResults.successi.length} cors{bulkResults.successi.length === 1 ? 'o assegnato' : 'i assegnati'} con successo
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {bulkResults.successi.map((title, i) => (
                            <li key={i} className="text-xs text-green-700">{title}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {bulkResults.errori.length > 0 && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-[7px]">
                      <span className="text-red-500 mt-0.5">⚠️</span>
                      <div>
                        <div className="text-sm font-medium text-red-800">
                          {bulkResults.errori.length} cors{bulkResults.errori.length === 1 ? 'o' : 'i'} con errore
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {bulkResults.errori.map((e, i) => (
                            <li key={i} className="text-xs text-red-700">
                              <span className="font-medium">{e.corso}:</span> {e.err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ) : bulkSaving && bulkProgress ? (
                <div className="py-10 text-center space-y-4">
                  <div className="text-sm text-gray-600 font-medium">
                    Assegnazione in corso... ({bulkProgress.done}/{bulkProgress.total})
                  </div>
                  <div className="w-full max-w-xs mx-auto bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, backgroundColor: '#d64b55' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Corsi senza formatore */}
                  {corsi.filter(c => !c.formatore_id).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Corso</th>
                            <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-14">Ore</th>
                            <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-10">Mod.</th>
                            <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide min-w-48">Formatore</th>
                            <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-32">Tariffa (€/h)</th>
                            <th className="text-left pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide w-28">Stato</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {corsi.filter(c => !c.formatore_id).map(corso => {
                            const row = bulkFormMap[corso.id] || { formatoreId: '', tariffa: '' }
                            const selF = row.formatoreId ? formatori.find(f => f.id === row.formatoreId) : null
                            const oreAssegnate = row.formatoreId ? (oreAssegnateMap[row.formatoreId] ?? 0) : 0
                            const hasValErr = bulkValidationErrors.has(corso.id)
                            return (
                              <tr key={corso.id} className={hasValErr ? 'bg-red-50' : ''}>
                                <td className="py-3 pr-4 align-top">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-900">{corso.title}</span>
                                    <StatusBadge variant={corso.tipo} size="sm" />
                                  </div>
                                </td>
                                <td className="py-3 pr-4 align-top text-gray-600">{corso.ore_totali}h</td>
                                <td className="py-3 pr-4 align-top pt-3.5">
                                  <ModalitaIcon modalita={corso.modalita} tipo={corso.tipo} size={16} />
                                </td>
                                <td className="py-3 pr-4 align-top">
                                  <select
                                    value={row.formatoreId}
                                    onChange={e => handleBulkFormatoreChange(corso.id, e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 bg-white focus:outline-none focus:border-[#d64b55] transition-colors"
                                  >
                                    <option value="">— Seleziona formatore —</option>
                                    {formatori.map(f => (
                                      <option key={f.id} value={f.id}>
                                        {f.nome}
                                        {!f.tariffa_oraria_formatore ? ' ⚠️ tariffa mancante' : ''}
                                        {(oreAssegnateMap[f.id] ?? 0) >= 200 ? ` ⚠️ ${oreAssegnateMap[f.id]}h` : ''}
                                      </option>
                                    ))}
                                  </select>
                                  {selF && !selF.tariffa_oraria_formatore && (
                                    <span className="text-xs text-orange-600 mt-0.5 block">⚠️ Tariffa mancante nel profilo</span>
                                  )}
                                  {oreAssegnate >= 200 && (
                                    <span className="text-xs text-orange-600 mt-0.5 block">⚠️ {oreAssegnate}h già assegnate</span>
                                  )}
                                </td>
                                <td className="py-3 pr-4 align-top">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={row.tariffa}
                                    onChange={e => handleBulkTariffaChange(corso.id, e.target.value, false)}
                                    placeholder="es. 70"
                                    disabled={!row.formatoreId}
                                    className={`w-full text-sm border rounded-[7px] px-2 py-1.5 focus:outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${hasValErr && row.formatoreId ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-[#d64b55]'}`}
                                  />
                                  {hasValErr && row.formatoreId && (
                                    <span className="text-xs text-red-600">Tariffa obbligatoria</span>
                                  )}
                                </td>
                                <td className="py-3 align-top">
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md whitespace-nowrap">Non assegnato</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-8">
                      Tutti i corsi hanno già un formatore assegnato.
                    </div>
                  )}

                  {/* Sezione corsi già assegnati (collassata) */}
                  {corsi.filter(c => c.formatore_id).length > 0 && (
                    <div className="border border-gray-100 rounded-[7px] overflow-hidden">
                      <button
                        onClick={() => setExistingExpanded(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
                      >
                        <span className="font-medium text-gray-700">
                          Modifica assegnazioni esistenti ({corsi.filter(c => c.formatore_id).length} cors{corsi.filter(c => c.formatore_id).length === 1 ? 'o' : 'i'})
                        </span>
                        <svg
                          width="16" height="16" fill="none" viewBox="0 0 24 24"
                          className={`text-gray-400 transition-transform ${existingExpanded ? 'rotate-180' : ''}`}
                        >
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {existingExpanded && (
                        <div className="p-4 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Corso</th>
                                <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-14">Ore</th>
                                <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide min-w-48">Formatore</th>
                                <th className="text-left pb-2 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-32">Tariffa (€/h)</th>
                                <th className="text-left pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide w-28">Stato</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {corsi.filter(c => c.formatore_id).map(corso => {
                                const row = existingFormMap[corso.id] || { formatoreId: corso.formatore_id as string, tariffa: String(corso.tariffa_oraria ?? '') }
                                const isChanged = row.formatoreId !== corso.formatore_id
                                const currentFormatore = corso.formatore as Profile | undefined
                                const stato = corso.stato_assegnazione
                                const badgeCls = stato === 'in_attesa' ? 'bg-amber-100 text-amber-700' : stato === 'accettato' ? 'bg-green-100 text-green-700' : stato === 'rifiutato' ? 'bg-red-100 text-red-700' : ''
                                const badgeLabel = stato === 'in_attesa' ? 'In attesa' : stato === 'accettato' ? 'Accettato' : stato === 'rifiutato' ? 'Rifiutato' : null
                                return (
                                  <tr key={corso.id} className={isChanged ? 'bg-amber-50' : ''}>
                                    <td className="py-3 pr-4 align-top">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-gray-900">{corso.title}</span>
                                        <StatusBadge variant={corso.tipo} size="sm" />
                                      </div>
                                    </td>
                                    <td className="py-3 pr-4 align-top text-gray-600">{corso.ore_totali}h</td>
                                    <td className="py-3 pr-4 align-top">
                                      {currentFormatore && isChanged && (
                                        <div className="text-xs text-gray-400 line-through mb-1">{currentFormatore.nome}</div>
                                      )}
                                      <select
                                        value={row.formatoreId}
                                        onChange={e => handleExistingFormatoreChange(corso.id, e.target.value)}
                                        className={`w-full text-sm border rounded-[7px] px-2 py-1.5 bg-white focus:outline-none focus:border-[#d64b55] transition-colors ${isChanged ? 'border-amber-400' : 'border-gray-200'}`}
                                      >
                                        {formatori.map(f => (
                                          <option key={f.id} value={f.id}>
                                            {f.nome}
                                            {!f.tariffa_oraria_formatore ? ' ⚠️ tariffa mancante' : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-3 pr-4 align-top">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={row.tariffa}
                                        onChange={e => handleBulkTariffaChange(corso.id, e.target.value, true)}
                                        disabled={!isChanged}
                                        className="w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 focus:outline-none focus:border-[#d64b55] transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                                      />
                                    </td>
                                    <td className="py-3 align-top">
                                      {badgeLabel ? (
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>{badgeLabel}</span>
                                      ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              {bulkResults ? (
                <Button onClick={() => setBulkOpen(false)}>Chiudi</Button>
              ) : bulkSaving ? null : (
                <>
                  <Button variant="secondary" onClick={() => setBulkOpen(false)}>Annulla</Button>
                  <Button
                    onClick={handleBulkSave}
                    disabled={
                      !Object.values(bulkFormMap).some(r => r.formatoreId) &&
                      !corsi.filter(c => c.formatore_id).some(c => existingFormMap[c.id]?.formatoreId !== c.formatore_id)
                    }
                  >
                    Salva tutte le assegnazioni
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cancellazione massiva corsi ───────────────────── */}
      {deleteBulkOpen && (() => {
        const selectedCorsi = corsi.filter(c => deleteSelected.has(c.id))
        const deletableCorsi = selectedCorsi.filter(c => isDeletable(c))
        const canConfirm = deleteBulkConfirmText === 'CANCELLA' && deletableCorsi.length > 0
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" style={{ border: '0.5px solid #e5e5e5' }}>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Elimina corsi selezionati</h2>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-2">
                  {selectedCorsi.map(c => {
                    const reason = nonDeletableReason(c)
                    return (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span className={reason ? 'text-gray-400 line-through' : 'text-gray-800'}>{c.title}</span>
                        {reason ? (
                          <span title={reason} className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 cursor-help ml-2 shrink-0">
                            Non eliminabile
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600 ml-2 shrink-0">Verrà eliminato</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {deletableCorsi.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-[7px] px-3 py-2">
                    Nessuno dei corsi selezionati può essere eliminato (hanno sessioni erogate, lettera firmata o sono completati).
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-red-600 font-medium">Questa azione è irreversibile.</p>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">
                        Digita <strong>CANCELLA</strong> per confermare
                      </label>
                      <input
                        type="text"
                        value={deleteBulkConfirmText}
                        onChange={e => setDeleteBulkConfirmText(e.target.value)}
                        placeholder="CANCELLA"
                        className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-red-400 transition-colors"
                      />
                    </div>
                  </>
                )}
                {deleteBulkError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-[7px] px-3 py-2">{deleteBulkError}</p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setDeleteBulkOpen(false)} disabled={deletingBulk}>Annulla</Button>
                <Button
                  onClick={handleBulkDelete}
                  loading={deletingBulk}
                  disabled={!canConfirm || deletingBulk}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Elimina definitivamente
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal: Aggiunta massiva corsi ────────────────────────── */}
      {bulkAddOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8" style={{ border: '0.5px solid #e5e5e5' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {bulkAddStep === 1 ? 'Aggiungi più corsi — Seleziona dal catalogo' : `Aggiungi più corsi — Configura (${Object.keys(bulkAddRows).length})`}
              </h2>
              {!savingBulkAdd && (
                <button
                  onClick={() => setBulkAddOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="px-6 py-5">
              {/* Step 1: catalog */}
              {bulkAddStep === 1 && (
                <div className="space-y-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <input
                      type="text"
                      value={bulkAddSearch}
                      onChange={e => setBulkAddSearch(e.target.value)}
                      placeholder="Cerca nel catalogo…"
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors"
                    />
                  </div>
                  {bulkAddSelected.size > 0 && (
                    <p className="text-xs text-blue-600">{bulkAddSelected.size} cors{bulkAddSelected.size === 1 ? 'o selezionato' : 'i selezionati'}</p>
                  )}
                  <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-[7px] divide-y divide-gray-50">
                    {catalogo
                      .filter(c => {
                        if (!c.attivo) return false
                        if (isDM38) {
                          if (c.finanziamento_id !== progetto.finanziamento_id) return false
                        } else {
                          if (c.finanziamento_id && c.finanziamento_id !== (progetto as ProgettoConStats & { finanziamento_id?: string | null }).finanziamento_id) return false
                        }
                        if (bulkAddSearch.trim()) {
                          const q = bulkAddSearch.trim().toLowerCase()
                          return c.titolo.toLowerCase().includes(q) || !!c.descrizione?.toLowerCase().includes(q)
                        }
                        return true
                      })
                      .map(c => (
                        <label key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={bulkAddSelected.has(c.id)}
                            onChange={() => setBulkAddSelected(prev => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                              return next
                            })}
                            className="w-4 h-4 accent-[#d64b55]"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{c.titolo}</span>
                              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${c.tipo === 'PF' ? 'bg-blue-100 text-blue-700' : c.tipo === 'MF' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                {c.tipo}
                              </span>
                            </div>
                            {c.descrizione && <p className="text-xs text-gray-400 truncate mt-0.5">{c.descrizione}</p>}
                          </div>
                        </label>
                      ))}
                    {catalogo.filter(c => c.attivo).length === 0 && (
                      <div className="px-4 py-6 text-sm text-gray-400 text-center">Nessun corso attivo nel catalogo.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: configure table */}
              {bulkAddStep === 2 && (
                <>
                  {bulkAddResults ? (
                    <div className="space-y-3">
                      {bulkAddResults.successi.length > 0 && (
                        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-[7px]">
                          <span className="text-green-600 mt-0.5">✅</span>
                          <div>
                            <div className="text-sm font-medium text-green-800">
                              {bulkAddResults.successi.length} cors{bulkAddResults.successi.length === 1 ? 'o aggiunto' : 'i aggiunti'} con successo
                            </div>
                            <ul className="mt-1.5 space-y-0.5">
                              {bulkAddResults.successi.map((t, i) => <li key={i} className="text-xs text-green-700">{t}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                      {bulkAddResults.errori.length > 0 && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-[7px]">
                          <span className="text-red-500 mt-0.5">⚠️</span>
                          <div>
                            <div className="text-sm font-medium text-red-800">{bulkAddResults.errori.length} errori</div>
                            <ul className="mt-1.5 space-y-0.5">
                              {bulkAddResults.errori.map((e, i) => <li key={i} className="text-xs text-red-700">{e}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : savingBulkAdd && bulkAddProgress ? (
                    <div className="py-10 text-center space-y-4">
                      <div className="text-sm text-gray-600 font-medium">
                        Aggiunta in corso… ({bulkAddProgress.done}/{bulkAddProgress.total})
                      </div>
                      <div className="w-full max-w-xs mx-auto bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(bulkAddProgress.done / bulkAddProgress.total) * 100}%`, backgroundColor: '#d64b55' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left pb-2 pr-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Corso</th>
                            <th className="text-left pb-2 pr-3 font-medium text-gray-500 text-xs uppercase tracking-wide w-16">Qtà</th>
                            <th className="text-left pb-2 pr-3 font-medium text-gray-500 text-xs uppercase tracking-wide w-24">Ore totali</th>
                            <th className="text-left pb-2 pr-3 font-medium text-gray-500 text-xs uppercase tracking-wide w-44">Modalità</th>
                            <th className="text-left pb-2 pr-3 font-medium text-gray-500 text-xs uppercase tracking-wide w-24">Tutor</th>
                            <th className="text-left pb-2 font-medium text-gray-500 text-xs uppercase tracking-wide w-32">Edizione</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {Object.values(bulkAddRows).map(row => {
                            const isMulti = row.qty > 1

                            const updateEdition = (idx: number, patch: Partial<BulkAddEdizione>) =>
                              setBulkAddRows(m => ({
                                ...m,
                                [row.catalogoId]: {
                                  ...m[row.catalogoId],
                                  editions: m[row.catalogoId].editions.map((e, i) => i === idx ? { ...e, ...patch } : e),
                                },
                              }))

                            const updateQtyForRow = (newQty: number) => {
                              if (newQty < 1 || newQty > 20) return
                              setBulkAddRows(m => {
                                const cur = m[row.catalogoId]
                                const eds = cur.editions
                                let newEds: BulkAddEdizione[]
                                if (newQty > eds.length) {
                                  // Label first edition when first expanding from 1
                                  const base = eds.length === 1 && cur.qty === 1
                                    ? [{ ...eds[0], edizione: eds[0].edizione || 'Edizione 1' }]
                                    : eds
                                  const last = base[base.length - 1]
                                  const toAdd = Array.from({ length: newQty - base.length }, (_, i) => ({
                                    ...last,
                                    edizione: `Edizione ${base.length + i + 1}`,
                                  }))
                                  newEds = [...base, ...toAdd]
                                } else {
                                  newEds = eds.slice(0, newQty)
                                }
                                return { ...m, [row.catalogoId]: { ...cur, qty: newQty, editions: newEds } }
                              })
                            }

                            const renderEditionCells = (ed: BulkAddEdizione, idx: number, compact: boolean) => {
                              const needsLocation = ['residenziale', 'semi_residenziale'].includes(ed.modalita)
                              const py = compact ? 'py-2' : 'py-3'
                              return (
                                <>
                                  <td className={`${py} pr-3 align-top`}>
                                    {isDM38 ? (
                                      <select
                                        value={ed.ore_totali}
                                        onChange={e => updateEdition(idx, { ore_totali: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 bg-white focus:outline-none focus:border-[#d64b55]"
                                      >
                                        <option value="30">30h</option>
                                        <option value="60">60h</option>
                                      </select>
                                    ) : (
                                      <input
                                        type="number"
                                        min={1}
                                        value={ed.ore_totali}
                                        onChange={e => updateEdition(idx, { ore_totali: e.target.value })}
                                        placeholder="Es. 20"
                                        className={`w-full text-sm border rounded-[7px] px-2 py-1.5 focus:outline-none focus:border-[#d64b55] transition-colors ${!ed.ore_totali ? 'border-red-300' : 'border-gray-200'}`}
                                      />
                                    )}
                                  </td>
                                  <td className={`${py} pr-3 align-top`}>
                                    <select
                                      value={ed.modalita}
                                      onChange={e => updateEdition(idx, {
                                        modalita: e.target.value,
                                        location: ['residenziale', 'semi_residenziale'].includes(e.target.value) ? ed.location : '',
                                      })}
                                      className="w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 bg-white focus:outline-none focus:border-[#d64b55]"
                                    >
                                      <option value="presenza">In presenza</option>
                                      {row.tipo !== 'Lab' && <option value="online">Online</option>}
                                      {row.tipo !== 'Lab' && <option value="ibrido">Ibrido</option>}
                                      <option value="residenziale">Residenziale</option>
                                      <option value="semi_residenziale">Semi-residenziale</option>
                                    </select>
                                    {needsLocation && (
                                      <input
                                        type="text"
                                        value={ed.location}
                                        onChange={e => updateEdition(idx, { location: e.target.value })}
                                        placeholder="Location *"
                                        className="mt-1.5 w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 focus:outline-none focus:border-[#d64b55]"
                                      />
                                    )}
                                  </td>
                                  <td className={`${py} pr-3 align-top`}>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={ed.tutor_previsto}
                                        onChange={e => updateEdition(idx, { tutor_previsto: e.target.checked, ore_tutoraggio: '' })}
                                        className="w-4 h-4 accent-[#d64b55]"
                                      />
                                      <span className="text-sm text-gray-700">Sì</span>
                                    </label>
                                    {ed.tutor_previsto && (
                                      <input
                                        type="number"
                                        min={1}
                                        value={ed.ore_tutoraggio}
                                        onChange={e => updateEdition(idx, { ore_tutoraggio: e.target.value })}
                                        placeholder="Ore tut."
                                        className="mt-1.5 w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 focus:outline-none focus:border-[#d64b55]"
                                      />
                                    )}
                                  </td>
                                  <td className={`${py} align-top`}>
                                    <input
                                      type="text"
                                      value={ed.edizione}
                                      onChange={e => updateEdition(idx, { edizione: e.target.value })}
                                      placeholder={isMulti ? `Edizione ${idx + 1}` : 'Es. 2025'}
                                      className="w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 focus:outline-none focus:border-[#d64b55]"
                                    />
                                  </td>
                                </>
                              )
                            }

                            return (
                              <React.Fragment key={row.catalogoId}>
                                {/* Main row */}
                                <tr className={isMulti ? 'bg-gray-50/40' : ''}>
                                  <td className="py-3 pr-3 align-top">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-gray-900">{row.title}</span>
                                      <span className={`inline-flex text-xs font-medium px-1.5 py-0.5 rounded ${row.tipo === 'PF' ? 'bg-blue-100 text-blue-700' : row.tipo === 'MF' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                        {row.tipo}
                                      </span>
                                    </div>
                                  </td>
                                  {/* Qty spinner */}
                                  <td className="py-3 pr-3 align-top">
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={row.qty}
                                      onChange={e => updateQtyForRow(Number(e.target.value))}
                                      className="w-full text-sm border border-gray-200 rounded-[7px] px-2 py-1.5 focus:outline-none focus:border-[#d64b55]"
                                    />
                                  </td>
                                  {/* When qty=1 show fields inline; when qty>1 leave cells empty */}
                                  {isMulti ? (
                                    <>
                                      <td className="py-3 pr-3" />
                                      <td className="py-3 pr-3" />
                                      <td className="py-3 pr-3" />
                                      <td className="py-3" />
                                    </>
                                  ) : (
                                    renderEditionCells(row.editions[0], 0, false)
                                  )}
                                </tr>

                                {/* Edition sub-rows when qty > 1 */}
                                {isMulti && row.editions.map((ed, idx) => (
                                  <tr key={idx} className="border-l-4 border-blue-300">
                                    <td className="py-2 pr-3 pl-5 align-top">
                                      <span className="text-xs font-medium text-blue-600">↳ Edizione {idx + 1}</span>
                                    </td>
                                    <td className="py-2 pr-3" />
                                    {renderEditionCells(ed, idx, true)}
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              {bulkAddResults ? (
                <Button onClick={() => setBulkAddOpen(false)}>Chiudi</Button>
              ) : savingBulkAdd ? null : bulkAddStep === 1 ? (
                <>
                  <Button variant="secondary" onClick={() => setBulkAddOpen(false)}>Annulla</Button>
                  <Button
                    onClick={initBulkAddRows}
                    disabled={bulkAddSelected.size === 0}
                  >
                    Configura corsi selezionati →
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setBulkAddStep(1)}>← Indietro</Button>
                  <Button
                    onClick={handleBulkAddSave}
                    disabled={Object.values(bulkAddRows).some(row =>
                      row.editions.some(ed =>
                        !ed.ore_totali || Number(ed.ore_totali) <= 0 ||
                        (['residenziale', 'semi_residenziale'].includes(ed.modalita) && !ed.location)
                      )
                    )}
                  >
                    Aggiungi tutti i corsi
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ASSEGNAZIONE_BADGES: Record<string, { label: string; cls: string }> = {
  in_attesa: { label: 'In attesa', cls: 'bg-amber-100 text-amber-700' },
  accettato:  { label: 'Accettato',  cls: 'bg-green-100 text-green-700'  },
  rifiutato:  { label: 'Rifiutato',  cls: 'bg-red-100 text-red-700'    },
}

function CourseRow({ corso, progettoId, oreErogate = 0, finanziamentoNome, selected, onToggle, deletable }: {
  corso: CorsoConOre; progettoId: string; oreErogate?: number; finanziamentoNome?: string | null
  selected?: boolean; onToggle?: (id: string) => void; deletable?: boolean
}) {
  const router = useRouter()
  const formatore = corso.formatore as Profile | undefined
  const badgeInfo = corso.stato_assegnazione ? ASSEGNAZIONE_BADGES[corso.stato_assegnazione] : undefined
  const oreTot = Number(corso.ore_totali)
  const orePian = Number(corso.ore_pianificate)
  const isCompletato = oreTot > 0 && oreErogate >= oreTot

  return (
    <div
      className={`px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${selected ? 'bg-red-50/60' : ''}`}
      onClick={() => router.push(`/progetti/${progettoId}/corsi/${corso.id}`)}
    >
      <div className="flex items-center gap-4">
        {onToggle && (
          <div onClick={e => e.stopPropagation()} className="shrink-0">
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={() => onToggle(corso.id)}
              title={deletable === false ? 'Non eliminabile' : undefined}
              className="w-4 h-4 accent-[#d64b55] cursor-pointer"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{corso.title}</span>
            <StatusBadge variant={corso.tipo} size="sm" />
            <ModalitaIcon modalita={corso.modalita} tipo={corso.tipo} size={14} />
            {finanziamentoNome && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${finanziamentoNome.includes('38') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {finanziamentoNome}
              </span>
            )}
            {corso.edizione && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                Ed. {corso.edizione}
              </span>
            )}
            {isCompletato && (
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-md">Completato</span>
            )}
          </div>
          <div className="text-xs text-gray-400">{oreTot}h totali</div>
        </div>
        <div className="w-52">
          <DualProgressBar oreTotali={oreTot} orePianificate={orePian} oreErogate={oreErogate} />
        </div>
        <div className="w-44 shrink-0 flex flex-col gap-1">
          {formatore ? (
            <>
              <div className="flex items-center gap-2">
                <Avatar nome={formatore.nome} id={formatore.id} initials={formatore.avatar_initials} size="sm" />
                <span className="text-xs text-gray-700 truncate">{formatore.nome}</span>
              </div>
              {badgeInfo && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${badgeInfo.cls}`}>
                  {badgeInfo.label}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-[7px] w-fit">Non assegnato</span>
          )}
        </div>
        <svg className="text-gray-300" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}
