'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CatalogoCorso } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'

function isValidUrl(s: string) {
  try { new URL(s); return true } catch { return false }
}

type CorsoForm = {
  titolo: string
  tipo: string
  descrizione: string
  link_scheda: string
}
const emptyForm: CorsoForm = { titolo: '', tipo: 'PF', descrizione: '', link_scheda: '' }

interface Props {
  initialCorsi: CatalogoCorso[]
  isSuperAdmin: boolean
}

export function CatalogoClient({ initialCorsi, isSuperAdmin }: Props) {
  const router = useRouter()
  const [corsi, setCorsi] = useState<CatalogoCorso[]>(initialCorsi)
  const [search, setSearch] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<CorsoForm>(emptyForm)
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)

  const [editCorso, setEditCorso] = useState<CatalogoCorso | null>(null)
  const [editForm, setEditForm] = useState<CorsoForm>(emptyForm)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deletingCorso, setDeletingCorso] = useState<CatalogoCorso | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return corsi
    return corsi.filter(c => c.titolo.toLowerCase().includes(q) || c.descrizione?.toLowerCase().includes(q))
  }, [corsi, search])

  const validateForm = (form: CorsoForm): string => {
    if (!form.titolo.trim()) return 'Il titolo è obbligatorio'
    if (!['PF', 'Lab'].includes(form.tipo)) return 'Tipo non valido'
    if (form.link_scheda.trim() && !isValidUrl(form.link_scheda.trim())) return 'Il link deve essere un URL valido'
    return ''
  }

  const handleAdd = async () => {
    const err = validateForm(addForm)
    if (err) { setAddError(err); return }
    setSaving(true)
    setAddError('')
    try {
      const res = await fetch('/api/catalogo-corsi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo: addForm.titolo.trim(),
          tipo: addForm.tipo,
          descrizione: addForm.descrizione.trim() || null,
          link_scheda: addForm.link_scheda.trim() || null,
          attivo: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Errore'); return }
      setCorsi(prev => [...prev, data].sort((a, b) => a.titolo.localeCompare(b.titolo)))
      setAddOpen(false)
      setAddForm(emptyForm)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (c: CatalogoCorso) => {
    setEditCorso(c)
    setEditForm({ titolo: c.titolo, tipo: c.tipo, descrizione: c.descrizione || '', link_scheda: c.link_scheda || '' })
    setEditError('')
  }

  const handleEdit = async () => {
    if (!editCorso) return
    const err = validateForm(editForm)
    if (err) { setEditError(err); return }
    setSavingEdit(true)
    setEditError('')
    try {
      const res = await fetch(`/api/catalogo-corsi/${editCorso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo: editForm.titolo.trim(),
          tipo: editForm.tipo,
          descrizione: editForm.descrizione.trim() || null,
          link_scheda: editForm.link_scheda.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error || 'Errore'); return }
      setCorsi(prev => prev.map(c => c.id === data.id ? data : c).sort((a, b) => a.titolo.localeCompare(b.titolo)))
      setEditCorso(null)
      router.refresh()
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleAttivo = async (corso: CatalogoCorso) => {
    setToggling(corso.id)
    try {
      const res = await fetch(`/api/catalogo-corsi/${corso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attivo: !corso.attivo }),
      })
      if (res.ok) {
        const data = await res.json()
        setCorsi(prev => prev.map(c => c.id === data.id ? data : c))
        router.refresh()
      }
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingCorso) return
    const res = await fetch(`/api/catalogo-corsi/${deletingCorso.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setCorsi(prev => prev.filter(c => c.id !== deletingCorso.id))
      setDeletingCorso(null)
      router.refresh()
    } else {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Errore durante l\'eliminazione')
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catalogo corsi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Template riutilizzabili per i corsi dei progetti</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/catalogo-corsi/tag"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-[7px] transition-colors"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Gestione tag
          </Link>
          <Button onClick={() => { setAddForm(emptyForm); setAddError(''); setAddOpen(true) }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Aggiungi corso
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per titolo o descrizione…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            {search ? 'Nessun corso trovato per questa ricerca.' : 'Nessun corso nel catalogo. Clicca "Aggiungi corso" per iniziare.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(corso => (
              <div key={corso.id} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-gray-900">{corso.titolo}</span>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${corso.tipo === 'PF' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {corso.tipo}
                    </span>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${corso.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {corso.attivo ? 'Attivo' : 'Inattivo'}
                    </span>
                  </div>
                  {corso.descrizione && (
                    <p className="text-sm text-gray-500 mb-1.5">{corso.descrizione}</p>
                  )}
                  {corso.link_scheda && (
                    <a
                      href={corso.link_scheda}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Scheda Google Drive
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleAttivo(corso)}
                    disabled={toggling === corso.id}
                    className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors disabled:opacity-50"
                  >
                    {toggling === corso.id ? '...' : corso.attivo ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button
                    onClick={() => openEdit(corso)}
                    className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
                  >
                    Modifica
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => setDeletingCorso(corso)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
                    >
                      Elimina
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Aggiungi corso al catalogo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} loading={saving} disabled={!addForm.titolo.trim()}>
              Aggiungi
            </Button>
          </>
        }
      >
        <CorsoFormFields form={addForm} onChange={setAddForm} error={addError} />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editCorso}
        onClose={() => setEditCorso(null)}
        title="Modifica corso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditCorso(null)}>Annulla</Button>
            <Button onClick={handleEdit} loading={savingEdit} disabled={!editForm.titolo.trim()}>
              Salva modifiche
            </Button>
          </>
        }
      >
        <CorsoFormFields form={editForm} onChange={setEditForm} error={editError} />
      </Modal>

      {/* Delete confirm */}
      {deletingCorso && (
        <DeleteConfirmModal
          open
          onClose={() => setDeletingCorso(null)}
          title={`Elimina — ${deletingCorso.titolo}`}
          description={`Sei sicuro di voler eliminare "${deletingCorso.titolo}" dal catalogo? Questa azione è irreversibile.`}
          confirmName={deletingCorso.titolo}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function CorsoFormFields({ form, onChange, error }: {
  form: CorsoForm
  onChange: (f: CorsoForm) => void
  error: string
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Titolo *"
        value={form.titolo}
        onChange={e => onChange({ ...form, titolo: e.target.value })}
        placeholder="Es. Sicurezza sul lavoro"
      />
      <Select
        label="Tipo *"
        value={form.tipo}
        onChange={e => onChange({ ...form, tipo: e.target.value })}
        options={[
          { value: 'PF', label: 'Percorso Formativo (PF)' },
          { value: 'Lab', label: 'Laboratorio sul Campo (Lab)' },
        ]}
      />
      <Input
        label="Descrizione breve"
        value={form.descrizione}
        onChange={e => onChange({ ...form, descrizione: e.target.value })}
        placeholder="Breve descrizione del contenuto del corso (opzionale)"
      />
      <Input
        label="Link Google Drive"
        value={form.link_scheda}
        onChange={e => onChange({ ...form, link_scheda: e.target.value })}
        placeholder="https://drive.google.com/..."
        hint="URL opzionale della scheda su Google Drive"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
