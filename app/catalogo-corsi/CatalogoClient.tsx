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

async function exportCatalogo(rows: CatalogoCorso[], finMap: Map<string, string>, filterFinId: string, finanziamenti: { id: string; nome: string }[]) {
  const XLSX = await import('xlsx')
  const headers = ['Titolo corso', 'Tipo', 'Descrizione', 'Linea di finanziamento', 'Tag', 'Link scheda']
  const data = rows.map(c => [
    c.titolo,
    c.tipo,
    c.descrizione || '',
    c.finanziamento_id ? (finMap.get(c.finanziamento_id) ?? '') : '',
    '',
    c.link_scheda || '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...data.map(r => String(r[i] ?? '').length)) + 2, 50),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogo')
  const today = new Date().toISOString().split('T')[0]
  const finNome = filterFinId ? (finanziamenti.find(f => f.id === filterFinId)?.nome ?? '').replace(/\s+/g, '_') : ''
  const fileName = finNome ? `Catalogo_${finNome}_${today}.xlsx` : `Catalogo_Completo_${today}.xlsx`
  XLSX.writeFile(wb, fileName)
}

function isValidUrl(s: string) {
  try { new URL(s); return true } catch { return false }
}

type CorsoForm = {
  titolo: string
  tipo: string
  finanziamento_id: string
  descrizione: string
  link_scheda: string
}
const emptyForm: CorsoForm = { titolo: '', tipo: 'PF', finanziamento_id: '', descrizione: '', link_scheda: '' }

interface Props {
  initialCorsi: CatalogoCorso[]
  isSuperAdmin: boolean
  finanziamenti: { id: string; nome: string }[]
}

function tipoBadgeClass(tipo: string) {
  if (tipo === 'PF') return 'bg-blue-100 text-blue-700'
  if (tipo === 'MF') return 'bg-green-100 text-green-700'
  return 'bg-purple-100 text-purple-700'
}

function finBadgeClass(nome: string) {
  if (nome.includes('38')) return 'bg-green-100 text-green-700'
  return 'bg-blue-100 text-blue-700'
}

export function CatalogoClient({ initialCorsi, isSuperAdmin, finanziamenti }: Props) {
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
  const [filterFinId, setFilterFinId] = useState('')

  const finMap = useMemo(() => new Map(finanziamenti.map(f => [f.id, f.nome])), [finanziamenti])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return corsi.filter(c => {
      if (filterFinId && c.finanziamento_id !== filterFinId) return false
      if (q) return c.titolo.toLowerCase().includes(q) || !!c.descrizione?.toLowerCase().includes(q)
      return true
    })
  }, [corsi, search, filterFinId])

  const validateForm = (form: CorsoForm): string => {
    if (!form.titolo.trim()) return 'Il titolo è obbligatorio'
    if (!['PF', 'Lab', 'MF'].includes(form.tipo)) return 'Tipo non valido'
    if (!form.finanziamento_id) return 'La linea di finanziamento è obbligatoria'
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
          finanziamento_id: addForm.finanziamento_id,
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
    setEditForm({
      titolo: c.titolo,
      tipo: c.tipo,
      finanziamento_id: c.finanziamento_id || '',
      descrizione: c.descrizione || '',
      link_scheda: c.link_scheda || '',
    })
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
          finanziamento_id: editForm.finanziamento_id || null,
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

  const hasFilters = !!(search.trim() || filterFinId)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catalogo corsi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} cors{filtered.length === 1 ? 'o' : 'i'}
            {hasFilters && <span className="ml-1 text-[#d64b55]">(filtrati)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCatalogo(filtered, finMap, filterFinId, finanziamenti)}
            className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Esporta Excel
          </button>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
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
        {finanziamenti.length > 0 && (
          <select
            value={filterFinId}
            onChange={e => setFilterFinId(e.target.value)}
            className="text-sm border border-gray-200 rounded-[7px] px-3 py-2.5 focus:outline-none focus:border-[#d64b55] bg-white"
          >
            <option value="">Tutti i finanziamenti</option>
            {finanziamenti.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterFinId('') }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-2.5"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            {hasFilters ? 'Nessun corso con i filtri selezionati.' : 'Nessun corso nel catalogo. Clicca "Aggiungi corso" per iniziare.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(corso => {
              const finNome = corso.finanziamento_id ? finMap.get(corso.finanziamento_id) : null
              return (
                <div key={corso.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-gray-900">{corso.titolo}</span>
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${tipoBadgeClass(corso.tipo)}`}>
                        {corso.tipo}
                      </span>
                      {finNome && (
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${finBadgeClass(finNome)}`}>
                          {finNome}
                        </span>
                      )}
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
              )
            })}
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
        <CorsoFormFields form={addForm} onChange={setAddForm} error={addError} finanziamenti={finanziamenti} />
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
        <CorsoFormFields form={editForm} onChange={setEditForm} error={editError} finanziamenti={finanziamenti} />
      </Modal>

      {/* Delete confirm */}
      {deletingCorso && (
        <DeleteConfirmModal
          open
          onClose={() => setDeletingCorso(null)}
          title={`Elimina — ${deletingCorso.titolo}`}
          description={`Sei sicuro di voler eliminare "${deletingCorso.titolo}" dal catalogo? Questa azione è irreversibile.`}
          confirmName="CANCELLA"
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function CorsoFormFields({ form, onChange, error, finanziamenti }: {
  form: CorsoForm
  onChange: (f: CorsoForm) => void
  error: string
  finanziamenti: { id: string; nome: string }[]
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
        label="Linea di finanziamento *"
        value={form.finanziamento_id}
        onChange={e => onChange({ ...form, finanziamento_id: e.target.value })}
        options={[
          { value: '', label: '— Seleziona —' },
          ...finanziamenti.map(f => ({ value: f.id, label: f.nome })),
        ]}
      />
      <Select
        label="Tipo *"
        value={form.tipo}
        onChange={e => onChange({ ...form, tipo: e.target.value })}
        options={[
          { value: 'PF', label: 'Percorso Formativo (PF)' },
          { value: 'Lab', label: 'Laboratorio sul Campo (Lab)' },
          { value: 'MF', label: 'Modulo Formativo (MF) — DM 38' },
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
