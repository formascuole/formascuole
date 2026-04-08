'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CorsoConOre, Sessione, Profile, Progetto, NotaCorso, Referente } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

interface CorsoDetailClientProps {
  corso: CorsoConOre & { formatore?: Profile; tutor?: Profile; referente?: Referente }
  progetto: Pick<Progetto, 'school_name' | 'anno_scolastico' | 'ref_name' | 'ref_email'> | null
  sessioni: Sessione[]
  formatori: Profile[]
  tutori: Profile[]
  dualRoleIds?: string[]
  referenti: Referente[]
  note: NotaCorso[]
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
  progettoId,
  currentUserId,
  isAdmin,
  canConfirmSessions,
  isSuperAdmin,
}: CorsoDetailClientProps) {
  const router = useRouter()
  const [sessioni, setSessioni] = useState<Sessione[]>(initialSessioni)
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
  const [newNota, setNewNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)
  const [deletingNota, setDeletingNota] = useState<string | null>(null)

  const isIbrido = corso.tipo === 'PF' && corso.modalita === 'ibrido'

  const orePianificate = Number(corso.ore_pianificate)
  const oreResidue = Math.max(Number(corso.ore_totali) - orePianificate, 0)
  const newOreNum = Number(newOre)
  const oreError = newOre && newOreNum > oreResidue ? `Max ${oreResidue}h residue` : ''
  const canSubmitSession = newData && newOre && !oreError && newOreNum > 0 && oreResidue > 0 &&
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
          ...(isIbrido && { modalita_sessione: newModalitaSessione }),
        }),
      })
      if (res.ok) {
        setCalendarOpen(false)
        setNewData('')
        setNewOre('')
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
    } finally {
      setDeletingNota(null)
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
      }
    } finally {
      setConfirmingId(null)
    }
  }

  // Sessions stats for the counter
  const today = new Date().toISOString().split('T')[0]
  const sessioniCompletate = sessioni.filter(s => s.completata).length
  const sessioniScadute = sessioni.filter(s => !s.completata && s.data <= today).length

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
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => setDeleteCorsoOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-[7px] transition-colors shrink-0"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Elimina corso
            </button>
          )}
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
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-400">Nessun formatore assegnato a questo corso.</p>
            {isAdmin && <Button size="sm" onClick={() => setFormatorePickerOpen(true)}>Assegna Formatore</Button>}
          </div>
        )}
      </div>

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
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ORE</th>
                {isIbrido && <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">MODALITÀ</th>}
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">STATO</th>
                {isAdmin && <th className="px-6 py-3"></th>}
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

      {/* Calendar Modal */}
      <Modal
        open={calendarOpen}
        onClose={() => { setCalendarOpen(false); setNewData(''); setNewOre(''); setNewModalitaSessione('presenza') }}
        title="Aggiungi Sessione"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCalendarOpen(false); setNewData(''); setNewOre(''); setNewModalitaSessione('presenza') }}>Annulla</Button>
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
          <Input
            label="Ore *"
            type="number"
            min={1}
            max={oreResidue}
            value={newOre}
            onChange={e => setNewOre(e.target.value)}
            hint={oreResidue > 0 ? `Max ${oreResidue}h residue` : 'Ore residue esaurite'}
            error={oreError}
            placeholder={`Es. ${Math.min(oreResidue, 4)}`}
          />
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
        onClose={() => setTutorePickerOpen(false)}
        title="Seleziona Tutor"
        size="md"
      >
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
    </div>
  )
}
