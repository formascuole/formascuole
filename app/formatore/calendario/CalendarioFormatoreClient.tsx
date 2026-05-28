'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarioGrid, CalendarioEvent, SessioneCalendarioEvent, IndisponibilitaCalendarioEvent } from '@/components/calendario/CalendarioGrid'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type SessioneRow = {
  id: string
  data: string
  ore: number
  completata: boolean
  corso_id: string
  corso_title: string
  school_name: string
  project_id: string
}

type IndisponibilitaRow = {
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
  currentUserId: string
  formatoreNome: string
}

export function CalendarioFormatoreClient({
  initialSessioni,
  initialIndisponibilita,
  currentUserId,
  formatoreNome,
}: Props) {
  const router = useRouter()
  const [sessioni, setSessioni] = useState<SessioneRow[]>(initialSessioni)
  const [indisponibilita, setIndisponibilita] = useState<IndisponibilitaRow[]>(initialIndisponibilita)

  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [addFascia, setAddFascia] = useState<'mattina' | 'pomeriggio' | 'tutto_il_giorno'>('tutto_il_giorno')
  const [addNote, setAddNote] = useState('')
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)

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
      formatore_id: currentUserId,
      formatore_nome: formatoreNome,
    }))

    const indEvs: IndisponibilitaCalendarioEvent[] = indisponibilita.map(i => ({
      kind: 'indisponibilita',
      id: i.id,
      formatore_id: i.formatore_id,
      formatore_nome: i.formatore_nome,
      data: i.data,
      fascia: i.fascia,
      note: i.note,
    }))

    return [...sessEvs, ...indEvs]
  }, [sessioni, indisponibilita, currentUserId, formatoreNome])

  const openAdd = (dateStr: string) => {
    setAddDate(dateStr)
    setAddFascia('tutto_il_giorno')
    setAddNote('')
    setAddError('')
    setAddOpen(true)
  }

  const handleAdd = async () => {
    setSaving(true)
    setAddError('')
    try {
      const res = await fetch('/api/indisponibilita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: addDate, fascia: addFascia, note: addNote.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error || 'Errore'); return }
      setIndisponibilita(prev => [...prev, {
        id: json.id,
        formatore_id: json.formatore_id,
        formatore_nome: json.formatore_nome,
        data: json.data,
        fascia: json.fascia,
        note: json.note,
      }])
      setAddOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteIndisponibilita = async (id: string) => {
    const res = await fetch(`/api/indisponibilita/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Errore')
    }
    setIndisponibilita(prev => prev.filter(i => i.id !== id))
    router.refresh()
  }

  const addDateIT = addDate
    ? addDate.split('-').reverse().join('/')
    : ''

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Il mio calendario</h1>
        <p className="text-sm text-gray-500 mt-1">Le tue sessioni e le tue indisponibilità</p>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '0.5px solid #e5e5e5' }}>
        <CalendarioGrid
          events={events}
          isAdmin={false}
          currentUserId={currentUserId}
          onDeleteIndisponibilita={handleDeleteIndisponibilita}
          onDayClick={openAdd}
        />
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Clicca su un giorno vuoto per aggiungere un&apos;indisponibilità.
      </p>

      {/* Add indisponibilità modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={`Aggiungi indisponibilità${addDateIT ? ` — ${addDateIT}` : ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} loading={saving}>Salva</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Data"
            type="date"
            value={addDate}
            onChange={e => setAddDate(e.target.value)}
          />
          <Select
            label="Fascia oraria"
            value={addFascia}
            onChange={e => setAddFascia(e.target.value as typeof addFascia)}
            options={[
              { value: 'mattina', label: 'Mattina' },
              { value: 'pomeriggio', label: 'Pomeriggio' },
              { value: 'tutto_il_giorno', label: 'Tutto il giorno' },
            ]}
          />
          <Input
            label="Note (opzionale)"
            value={addNote}
            onChange={e => setAddNote(e.target.value)}
            placeholder="Es. Impegno personale"
          />
          {addError && <p className="text-sm text-red-600">{addError}</p>}
        </div>
      </Modal>
    </div>
  )
}
