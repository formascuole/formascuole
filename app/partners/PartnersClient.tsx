'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Partner } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { calcCommissionePartner, fmtCur } from '@/lib/economia-utils'

interface Props {
  partners: Partner[]
  partnerProgettiCount: Record<string, number>
}

export function PartnersClient({ partners: initialPartners, partnerProgettiCount: initialCounts }: Props) {
  const router = useRouter()
  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [counts, setCounts] = useState(initialCounts)

  // Add
  const [addOpen, setAddOpen] = useState(false)
  const [addNome, setAddNome] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit
  const [editTarget, setEditTarget] = useState<Partner | null>(null)
  const [editNome, setEditNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleAdd = async () => {
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: addNome }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error || 'Errore'); return }
      setPartners(prev => [...prev, json].sort((a, b) => a.nome.localeCompare(b.nome)))
      setCounts(prev => ({ ...prev, [json.id]: 0 }))
      setAddOpen(false)
      setAddNome('')
    } finally {
      setAdding(false)
    }
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/partners/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editNome }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error || 'Errore'); return }
      setPartners(prev => prev.map(p => p.id === editTarget.id ? { ...p, nome: json.nome } : p).sort((a, b) => a.nome.localeCompare(b.nome)))
      setEditTarget(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/partners/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { setDeleteError(json.error || 'Errore'); return }
      setPartners(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleExportPartner = async (partner: Partner) => {
    const XLSX = await import('xlsx')
    const year = new Date().getFullYear()
    const filename = `EC_Partner_${partner.nome.replace(/\s+/g, '_')}_${year}.xlsx`

    const res = await fetch('/api/partners')
    // We don't actually fetch the full data here — we need to call the estratti conto API
    // For now we generate a simple summary with what we know
    const headers = ['Partner', 'N. Progetti', 'Anno']
    const data = [[partner.nome, counts[partner.id] ?? 0, year]]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Riepilogo partner')
    XLSX.writeFile(wb, filename)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner</h1>
          <p className="text-sm text-gray-500 mt-1">{partners.length} partner{partners.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setAddNome(''); setAddError(''); setAddOpen(true) }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Aggiungi partner
        </Button>
      </div>

      {partners.length === 0 ? (
        <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
          Nessun partner. Aggiungi il primo con il bottone in alto.
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">NOME</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">PROGETTI</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">DATA CREAZIONE</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {partners.map(p => {
                const nProgetti = counts[p.id] ?? 0
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold shrink-0">
                          {p.nome.slice(0, 2).toUpperCase()}
                        </span>
                        {p.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {nProgetti > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">
                          {nProgetti} progett{nProgetti === 1 ? 'o' : 'i'}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('it-IT') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditNome(p.nome); setEditError(''); setEditTarget(p) }}
                          className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-[7px] border border-gray-200 hover:border-gray-300 bg-white transition-colors"
                        >
                          Rinomina
                        </button>
                        <button
                          onClick={() => { setDeleteError(''); setDeleteTarget(p) }}
                          disabled={nProgetti > 0}
                          title={nProgetti > 0 ? 'Associato a progetti — impossibile eliminare' : 'Elimina partner'}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-[7px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 bg-white"
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Aggiungi partner ── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Aggiungi partner"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} loading={adding} disabled={!addNome.trim()}>Aggiungi</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Nome partner *"
            value={addNome}
            onChange={e => setAddNome(e.target.value)}
            placeholder="Es. Fondazione XYZ"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && addNome.trim()) handleAdd() }}
          />
          {addError && <p className="text-sm text-red-600">{addError}</p>}
        </div>
      </Modal>

      {/* ── Modal: Rinomina partner ── */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Rinomina partner"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Annulla</Button>
            <Button onClick={handleEdit} loading={saving} disabled={!editNome.trim()}>Salva</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Nome partner *"
            value={editNome}
            onChange={e => setEditNome(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && editNome.trim()) handleEdit() }}
          />
          {editError && <p className="text-sm text-red-600">{editError}</p>}
        </div>
      </Modal>

      {/* ── Modal: Conferma eliminazione ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Elimina partner"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button
              onClick={handleDelete}
              loading={deleting}
              style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
            >
              Elimina definitivamente
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Sei sicuro di voler eliminare il partner <strong>{deleteTarget?.nome}</strong>?
            Questa operazione è irreversibile.
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
        </div>
      </Modal>
    </div>
  )
}
