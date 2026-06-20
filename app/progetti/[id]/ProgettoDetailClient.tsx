'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProgettoConStats, CorsoConOre, Profile, ChatMessaggio, Referente, Finanziamento, CatalogoCorso, QuestionarioRisultato } from '@/lib/types'
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
  catalogo: CatalogoCorso[]
  currentUserId: string
  isSuperAdmin?: boolean
  questionari?: QuestionarioRisultato[]
  oreErogatePerCorso?: Record<string, number>
}

type EditScuolaForm = {
  school_name: string
  address: string
  anno_scolastico: string
  finanziamento_id: string
  status: string
  regione: string
  provincia: string
  citta: string
}

type ReferenteForm = { nome: string; email: string; tel: string; ruolo: string }
const emptyReferenteForm: ReferenteForm = { nome: '', email: '', tel: '', ruolo: '' }

export function ProgettoDetailClient({
  progetto,
  corsi,
  formatori,
  messaggi: initialMessaggi,
  referenti: initialReferenti,
  finanziamenti,
  catalogo,
  currentUserId,
  isSuperAdmin,
  questionari = [],
  oreErogatePerCorso = {},
}: ProgettoDetailClientProps) {
  const router = useRouter()

  // ── Delete progetto ──────────────────────────────────────────
  const [deleteProgettoOpen, setDeleteProgettoOpen] = useState(false)

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

  const resetAddCorso = () => {
    setAddCorsoStep(1)
    setCatalogoSearch('')
    setCorsoForm({ title: '', tipo: 'PF', ore_totali: '', modalita: 'presenza', tutor_previsto: false, tutor_nome: '', ore_tutoraggio: '', descrizione: '', link_scheda: '', edizione: '', note: '', location: '' })
  }

  const selectFromCatalogo = (c: CatalogoCorso) => {
    setCorsoForm(f => ({
      ...f,
      title: c.titolo,
      tipo: c.tipo,
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
      router.refresh()
    } finally {
      setSavingScuola(false)
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
          <h2 className="font-semibold text-gray-900">Corsi ({corsi.length})</h2>
          <Button size="sm" onClick={() => setAddCorsoOpen(true)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Aggiungi Corso
          </Button>
        </div>
        <div className="divide-y divide-gray-50">
          {corsi.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Nessun corso aggiunto. Clicca &quot;Aggiungi Corso&quot; per iniziare.
            </div>
          ) : (
            corsi.map(corso => <CourseRow key={corso.id} corso={corso} progettoId={progetto.id} oreErogate={oreErogatePerCorso[corso.id] ?? 0} />)
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
                disabled={!corsoForm.title || !corsoForm.ore_totali || !corsoForm.modalita || (corsoForm.tutor_previsto && !corsoForm.tutor_nome) || (['residenziale', 'semi_residenziale'].includes(corsoForm.modalita) && !corsoForm.location.trim())}
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
                .filter(c => c.attivo && (
                  !catalogoSearch.trim() ||
                  c.titolo.toLowerCase().includes(catalogoSearch.trim().toLowerCase()) ||
                  c.descrizione?.toLowerCase().includes(catalogoSearch.trim().toLowerCase())
                ))
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectFromCatalogo(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{c.titolo}</span>
                      <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${c.tipo === 'PF' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
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
            <Input label="Titolo corso *" value={corsoForm.title} onChange={e => setCorsoForm(f => ({ ...f, title: e.target.value }))} placeholder="Es. Sicurezza sul lavoro" />
            <div className="grid grid-cols-2 gap-3">
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
              <Input label="Ore totali *" type="number" min={1} value={corsoForm.ore_totali} onChange={e => setCorsoForm(f => ({ ...f, ore_totali: e.target.value }))} placeholder="Es. 20" />
            </div>
            <Select
              label="Modalità erogazione *"
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
            {corsoForm.tipo === 'PF' && (
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
    </div>
  )
}

const ASSEGNAZIONE_BADGES: Record<string, { label: string; cls: string }> = {
  in_attesa: { label: 'In attesa', cls: 'bg-amber-100 text-amber-700' },
  accettato:  { label: 'Accettato',  cls: 'bg-green-100 text-green-700'  },
  rifiutato:  { label: 'Rifiutato',  cls: 'bg-red-100 text-red-700'    },
}

function CourseRow({ corso, progettoId, oreErogate = 0 }: { corso: CorsoConOre; progettoId: string; oreErogate?: number }) {
  const router = useRouter()
  const formatore = corso.formatore as Profile | undefined
  const badgeInfo = corso.stato_assegnazione ? ASSEGNAZIONE_BADGES[corso.stato_assegnazione] : undefined
  const oreTot = Number(corso.ore_totali)
  const orePian = Number(corso.ore_pianificate)
  const isCompletato = oreTot > 0 && oreErogate >= oreTot

  return (
    <div
      className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => router.push(`/progetti/${progettoId}/corsi/${corso.id}`)}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{corso.title}</span>
            <StatusBadge variant={corso.tipo} size="sm" />
            <ModalitaIcon modalita={corso.modalita} tipo={corso.tipo} size={14} />
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
