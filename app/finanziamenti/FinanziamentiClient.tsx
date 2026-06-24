'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Finanziamento } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

interface FinanziamentiClientProps {
  finanziamenti: Finanziamento[]
}

type FormState = { nome: string; descrizione: string; attivo: boolean; tariffa_formatore_ora: string; tariffa_tutor_ora: string }
const emptyForm: FormState = { nome: '', descrizione: '', attivo: true, tariffa_formatore_ora: '', tariffa_tutor_ora: '' }

export function FinanziamentiClient({ finanziamenti: initial }: FinanziamentiClientProps) {
  const router = useRouter()
  const [finanziamenti, setFinanziamenti] = useState<Finanziamento[]>(initial)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const [editTarget, setEditTarget] = useState<Finanziamento | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleAdd = async () => {
    setAddError('')
    setSaving(true)
    try {
      const res = await fetch('/api/finanziamenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          tariffa_formatore_ora: addForm.tariffa_formatore_ora.trim() ? Number(addForm.tariffa_formatore_ora) : null,
          tariffa_tutor_ora: addForm.tariffa_tutor_ora.trim() ? Number(addForm.tariffa_tutor_ora) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error || 'Errore'); return }
      setFinanziamenti(prev => [...prev, json].sort((a, b) => a.nome.localeCompare(b.nome)))
      setAddOpen(false)
      setAddForm(emptyForm)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (f: Finanziamento) => {
    setEditTarget(f)
    setEditForm({
      nome: f.nome,
      descrizione: f.descrizione || '',
      attivo: f.attivo,
      tariffa_formatore_ora: f.tariffa_formatore_ora != null ? String(f.tariffa_formatore_ora) : '',
      tariffa_tutor_ora: f.tariffa_tutor_ora != null ? String(f.tariffa_tutor_ora) : '',
    })
    setEditError('')
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditError('')
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/finanziamenti/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          tariffa_formatore_ora: editForm.tariffa_formatore_ora.trim() ? Number(editForm.tariffa_formatore_ora) : null,
          tariffa_tutor_ora: editForm.tariffa_tutor_ora.trim() ? Number(editForm.tariffa_tutor_ora) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error || 'Errore'); return }
      setFinanziamenti(prev => prev.map(f => f.id === json.id ? json : f).sort((a, b) => a.nome.localeCompare(b.nome)))
      setEditTarget(null)
      router.refresh()
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleAttivo = async (f: Finanziamento) => {
    setTogglingId(f.id)
    try {
      const res = await fetch(`/api/finanziamenti/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attivo: !f.attivo }),
      })
      const json = await res.json()
      if (res.ok) {
        setFinanziamenti(prev => prev.map(item => item.id === json.id ? json : item))
        router.refresh()
      }
    } finally {
      setTogglingId(null)
    }
  }

  const attivi = finanziamenti.filter(f => f.attivo)
  const inattivi = finanziamenti.filter(f => !f.attivo)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanziamenti</h1>
          <p className="text-sm text-gray-500 mt-1">{finanziamenti.length} finanziament{finanziamenti.length === 1 ? 'o' : 'i'} · {attivi.length} attiv{attivi.length === 1 ? 'o' : 'i'}</p>
        </div>
        <Button onClick={() => { setAddForm(emptyForm); setAddError(''); setAddOpen(true) }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Aggiungi Finanziamento
        </Button>
      </div>

      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        {finanziamenti.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            Nessun finanziamento. Clicca &quot;Aggiungi Finanziamento&quot; per iniziare.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {finanziamenti.map((f) => (
              <div key={f.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-gray-900">{f.nome}</span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-md"
                      style={f.attivo
                        ? { backgroundColor: '#dcfce7', color: '#166534' }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                      }
                    >
                      {f.attivo ? 'Attivo' : 'Inattivo'}
                    </span>
                  </div>
                  {(f.tariffa_formatore_ora != null || f.tariffa_tutor_ora != null) && (
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      {f.tariffa_formatore_ora != null && <span>Formatore: €{Number(f.tariffa_formatore_ora).toFixed(2)}/h</span>}
                      {f.tariffa_tutor_ora != null && <span>Tutor: €{Number(f.tariffa_tutor_ora).toFixed(2)}/h</span>}
                    </div>
                  )}
                  {f.descrizione && (
                    <p className="text-xs text-gray-400 truncate">{f.descrizione}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle attivo inline */}
                  <button
                    onClick={() => handleToggleAttivo(f)}
                    disabled={togglingId === f.id}
                    className="text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-[7px] border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {togglingId === f.id ? '...' : f.attivo ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button
                    onClick={() => openEdit(f)}
                    className="text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-[7px] border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Modifica
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inattivi.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          I finanziamenti inattivi non appaiono nel menu a tendina dei progetti ma restano associati ai progetti esistenti.
        </p>
      )}

      {/* Modal: Aggiungi */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Aggiungi Finanziamento"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} loading={saving} disabled={!addForm.nome.trim()}>
              Aggiungi
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            value={addForm.nome}
            onChange={e => setAddForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Es. DM 219/2025"
          />
          <Input
            label="Descrizione"
            value={addForm.descrizione}
            onChange={e => setAddForm(f => ({ ...f, descrizione: e.target.value }))}
            placeholder="Breve descrizione opzionale"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tariffa formatore/ora (€)"
              type="number"
              min={0}
              step={0.01}
              value={addForm.tariffa_formatore_ora}
              onChange={e => setAddForm(f => ({ ...f, tariffa_formatore_ora: e.target.value }))}
              placeholder="Es. 122.00"
              hint="Lascia vuoto se non applicabile"
            />
            <Input
              label="Tariffa tutor/ora (€)"
              type="number"
              min={0}
              step={0.01}
              value={addForm.tariffa_tutor_ora}
              onChange={e => setAddForm(f => ({ ...f, tariffa_tutor_ora: e.target.value }))}
              placeholder="Es. 34.00"
              hint="Lascia vuoto se non applicabile"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={addForm.attivo}
              onChange={e => setAddForm(f => ({ ...f, attivo: e.target.checked }))}
              className="w-4 h-4 rounded accent-[#d64b55]"
            />
            <span className="text-sm font-medium text-gray-700">Attivo</span>
          </label>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
        </div>
      </Modal>

      {/* Modal: Modifica */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Modifica — ${editTarget?.nome}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Annulla</Button>
            <Button onClick={handleEdit} loading={savingEdit} disabled={!editForm.nome.trim()}>
              Salva
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            value={editForm.nome}
            onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
          />
          <Input
            label="Descrizione"
            value={editForm.descrizione}
            onChange={e => setEditForm(f => ({ ...f, descrizione: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tariffa formatore/ora (€)"
              type="number"
              min={0}
              step={0.01}
              value={editForm.tariffa_formatore_ora}
              onChange={e => setEditForm(f => ({ ...f, tariffa_formatore_ora: e.target.value }))}
              placeholder="Es. 122.00"
              hint="Lascia vuoto se non applicabile"
            />
            <Input
              label="Tariffa tutor/ora (€)"
              type="number"
              min={0}
              step={0.01}
              value={editForm.tariffa_tutor_ora}
              onChange={e => setEditForm(f => ({ ...f, tariffa_tutor_ora: e.target.value }))}
              placeholder="Es. 34.00"
              hint="Lascia vuoto se non applicabile"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.attivo}
              onChange={e => setEditForm(f => ({ ...f, attivo: e.target.checked }))}
              className="w-4 h-4 rounded accent-[#d64b55]"
            />
            <span className="text-sm font-medium text-gray-700">Attivo</span>
          </label>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
        </div>
      </Modal>
    </div>
  )
}
