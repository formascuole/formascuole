'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Tag } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: tag.colore + '22', color: tag.colore, border: `1px solid ${tag.colore}44` }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: tag.colore }} />
      {tag.nome}
    </span>
  )
}

interface Props {
  initialTags: Tag[]
  usageMap: Record<string, number>
  isSuperAdmin: boolean
}

export function TagsClient({ initialTags, usageMap: initialUsageMap, isSuperAdmin }: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [usageMap, setUsageMap] = useState<Record<string, number>>(initialUsageMap)

  // Add modal state
  const [addOpen, setAddOpen] = useState(false)
  const [newNome, setNewNome] = useState('')
  const [newColore, setNewColore] = useState('#378ADD')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!newNome.trim()) { setAddError('Nome obbligatorio'); return }
    setAddLoading(true)
    setAddError('')
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: newNome.trim(), colore: newColore }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Errore'); return }
      setTags(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setUsageMap(prev => ({ ...prev, [data.id]: 0 }))
      setNewNome('')
      setNewColore('#378ADD')
      setAddOpen(false)
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
      if (res.status === 204) {
        setTags(prev => prev.filter(t => t.id !== id))
        setUsageMap(prev => { const m = { ...prev }; delete m[id]; return m })
        setConfirmDeleteId(null)
      } else {
        const data = await res.json()
        setDeleteError(data.error || 'Errore durante l\'eliminazione')
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/catalogo-corsi"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Catalogo corsi
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestione tag</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tag riutilizzabili per corsi e competenze formatori</p>
        </div>
        <Button onClick={() => { setNewNome(''); setNewColore('#378ADD'); setAddError(''); setAddOpen(true) }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Aggiungi tag
        </Button>
      </div>

      {/* Tag list */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        {tags.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            Nessun tag ancora. Aggiungine uno per iniziare.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tags.map(tag => {
              const usage = usageMap[tag.id] ?? 0
              const isConfirmingDelete = confirmDeleteId === tag.id
              return (
                <div key={tag.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <TagPill tag={tag} />
                    {usage > 0 ? (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                        {usage} {usage === 1 ? 'assegnazione' : 'assegnazioni'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-gray-50 text-gray-400">
                        Non utilizzato
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isConfirmingDelete ? (
                      <>
                        {deleteError && (
                          <span className="text-xs text-red-500 max-w-xs truncate">{deleteError}</span>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deleteLoading}
                          onClick={() => handleDelete(tag.id)}
                        >
                          Conferma
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                        >
                          Annulla
                        </Button>
                      </>
                    ) : (
                      usage === 0 && (
                        <button
                          onClick={() => { setConfirmDeleteId(tag.id); setDeleteError(null) }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                          title="Elimina tag"
                        >
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Elimina
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add tag modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Aggiungi tag"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} loading={addLoading} disabled={!newNome.trim()}>Aggiungi</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome tag"
            value={newNome}
            onChange={e => setNewNome(e.target.value)}
            placeholder="Es. Sicurezza sul Lavoro"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Colore</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newColore}
                onChange={e => setNewColore(e.target.value)}
                className="w-10 h-10 border border-gray-200 rounded-[7px] cursor-pointer p-0.5"
              />
              {newNome && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: newColore + '22', color: newColore, border: `1px solid ${newColore}44` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: newColore }} />
                  {newNome}
                </span>
              )}
            </div>
          </div>
          {addError && <p className="text-sm text-red-500">{addError}</p>}
        </div>
      </Modal>
    </div>
  )
}
