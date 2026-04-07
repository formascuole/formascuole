'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProgettoConStats, CorsoConOre, Profile, ChatMessaggio } from '@/lib/types'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

interface ProgettoDetailClientProps {
  progetto: ProgettoConStats
  corsi: CorsoConOre[]
  formatori: Profile[]
  messaggi: ChatMessaggio[]
  currentUserId: string
}

export function ProgettoDetailClient({ progetto, corsi, formatori, messaggi: initialMessaggi, currentUserId }: ProgettoDetailClientProps) {
  const router = useRouter()
  const [addCorsoOpen, setAddCorsoOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [corsoForm, setCorsoForm] = useState({
    title: '',
    tipo: 'PF',
    ore_totali: '',
    modalita: 'presenza',
    tutor_previsto: false,
    tutor_nome: '',
    ore_tutoraggio: '',
  })

  // Chat state
  const [messaggi, setMessaggi] = useState<ChatMessaggio[]>(initialMessaggi)
  const [newMsg, setNewMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const pct = Number(progetto.percentuale_completamento)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messaggi])

  // Mark unread messages as read on mount
  useEffect(() => {
    const unread = initialMessaggi
      .filter(m => !m.letto && m.autore_id !== currentUserId)
      .map(m => m.id)
    if (unread.length > 0) {
      fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaggio_ids: unread }),
      }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddCorso = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/corsi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: progetto.id,
          title: corsoForm.title,
          tipo: corsoForm.tipo,
          ore_totali: Number(corsoForm.ore_totali),
          ...(corsoForm.tipo === 'PF' && { modalita: corsoForm.modalita }),
          tutor_previsto: corsoForm.tutor_previsto,
          ...(corsoForm.tutor_previsto && corsoForm.tutor_nome && { tutor_nome: corsoForm.tutor_nome }),
          ...(corsoForm.tutor_previsto && corsoForm.ore_tutoraggio && { ore_tutoraggio: Number(corsoForm.ore_tutoraggio) }),
        }),
      })
      if (res.ok) {
        setAddCorsoOpen(false)
        setCorsoForm({ title: '', tipo: 'PF', ore_totali: '', modalita: 'presenza', tutor_previsto: false, tutor_nome: '', ore_tutoraggio: '' })
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

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
            <p className="text-sm text-gray-500">{progetto.address} · {progetto.anno_scolastico}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">REFERENTE</div>
            <div className="font-medium text-sm text-gray-800">{progetto.ref_name}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">EMAIL</div>
            <a href={`mailto:${progetto.ref_email}`} className="text-sm text-blue-600 hover:underline">{progetto.ref_email}</a>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">TELEFONO</div>
            <div className="text-sm text-gray-800">{progetto.ref_tel || '—'}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Progresso ore complessive</span>
            <span className="font-semibold text-gray-700">{progetto.ore_pianificate}h / {progetto.ore_totali}h ({pct}%)</span>
          </div>
          <ProgressBar value={pct} size="lg" />
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
            corsi.map((corso) => (
              <CourseRow key={corso.id} corso={corso} progettoId={progetto.id} />
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

        {/* Messages */}
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {messaggi.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nessun messaggio ancora. Inizia la conversazione!
            </p>
          ) : (
            messaggi.map((m) => {
              const isMe = m.autore_id === currentUserId
              return (
                <div key={m.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {m.autore && (
                    <Avatar nome={m.autore.nome} id={m.autore.id} initials={m.autore.avatar_initials} size="sm" />
                  )}
                  <div className={`max-w-xs flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {!isMe && <span className="text-xs font-medium text-gray-700">{m.autore?.nome}</span>}
                      <span className="text-xs text-gray-400">{formatDate(m.created_at)}</span>
                    </div>
                    <div
                      className={`text-sm px-3 py-2 rounded-xl break-words ${
                        isMe ? 'text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
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

        {/* Input */}
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
            <Button size="sm" onClick={handleSendMsg} loading={sendingMsg} disabled={!newMsg.trim()}>
              Invia
            </Button>
          </div>
        </div>
      </div>

      {/* Add corso modal */}
      <Modal
        open={addCorsoOpen}
        onClose={() => setAddCorsoOpen(false)}
        title="Aggiungi Corso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddCorsoOpen(false)}>Annulla</Button>
            <Button
              onClick={handleAddCorso}
              loading={saving}
              disabled={
                !corsoForm.title ||
                !corsoForm.ore_totali ||
                (corsoForm.tipo === 'PF' && !corsoForm.modalita) ||
                (corsoForm.tutor_previsto && !corsoForm.tutor_nome)
              }
            >
              Aggiungi
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Titolo corso *"
            value={corsoForm.title}
            onChange={e => setCorsoForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Es. Sicurezza sul lavoro"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo *"
              value={corsoForm.tipo}
              onChange={e => setCorsoForm(f => ({ ...f, tipo: e.target.value, modalita: e.target.value === 'PF' ? 'presenza' : '' }))}
              options={[
                { value: 'PF', label: 'Percorso Formativo (PF)' },
                { value: 'Lab', label: 'Laboratorio sul Campo (Lab)' },
              ]}
            />
            <Input
              label="Ore totali *"
              type="number"
              min={1}
              value={corsoForm.ore_totali}
              onChange={e => setCorsoForm(f => ({ ...f, ore_totali: e.target.value }))}
              placeholder="Es. 20"
            />
          </div>

          {corsoForm.tipo === 'PF' && (
            <Select
              label="Modalità erogazione *"
              value={corsoForm.modalita}
              onChange={e => setCorsoForm(f => ({ ...f, modalita: e.target.value }))}
              options={[
                { value: 'presenza', label: 'In presenza' },
                { value: 'online', label: 'Online' },
                { value: 'ibrido', label: 'Ibrido (presenza + online)' },
              ]}
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
                  <Input
                    label="Nome tutor *"
                    value={corsoForm.tutor_nome}
                    onChange={e => setCorsoForm(f => ({ ...f, tutor_nome: e.target.value }))}
                    placeholder="Es. Anna Verdi"
                  />
                  <Input
                    label="Ore tutoraggio"
                    type="number"
                    min={1}
                    value={corsoForm.ore_tutoraggio}
                    onChange={e => setCorsoForm(f => ({ ...f, ore_tutoraggio: e.target.value }))}
                    placeholder="Es. 10"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function CourseRow({ corso, progettoId }: { corso: CorsoConOre; progettoId: string }) {
  const router = useRouter()
  const pct = corso.ore_totali > 0 ? Math.min(Math.round((corso.ore_pianificate / corso.ore_totali) * 100), 100) : 0
  const formatore = corso.formatore as Profile | undefined

  return (
    <div
      className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => router.push(`/progetti/${progettoId}/corsi/${corso.id}`)}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">{corso.title}</span>
            <StatusBadge variant={corso.tipo} size="sm" />
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{corso.ore_totali}h totali</span>
            <span>{corso.ore_pianificate}h pianificate</span>
            {corso.calendario_completo && (
              <span className="text-green-600 flex items-center gap-1">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Completo
              </span>
            )}
          </div>
        </div>

        <div className="w-36">
          <ProgressBar value={pct} size="sm" showLabel />
        </div>

        <div className="w-40 shrink-0">
          {formatore ? (
            <div className="flex items-center gap-2">
              <Avatar nome={formatore.nome} id={formatore.id} initials={formatore.avatar_initials} size="sm" />
              <span className="text-xs text-gray-700 truncate">{formatore.nome}</span>
            </div>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-[7px]">
              Nessun formatore
            </span>
          )}
        </div>

        <svg className="text-gray-300" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}
