'use client'
import { useState } from 'react'
import { Tag } from '@/lib/types'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Input'

function TagPill({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: tag.colore + '22', color: tag.colore, border: `1px solid ${tag.colore}44` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.colore }} />
      {tag.nome}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label={`Rimuovi ${tag.nome}`}
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </span>
  )
}

interface TagsSectionProps {
  tags: Tag[]
  allTags: Tag[]
  isAdmin: boolean
  onAddTag: (tagId: string) => Promise<void>
  onRemoveTag: (tagId: string) => Promise<void>
  onCreateTag: (nome: string, colore: string) => Promise<Tag>
  label?: string
}

export function TagsSection({ tags, allTags, isAdmin, onAddTag, onRemoveTag, onCreateTag, label = 'Tag' }: TagsSectionProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newNome, setNewNome] = useState('')
  const [newColore, setNewColore] = useState('#378ADD')
  const [createError, setCreateError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  const assigned = new Set(tags.map(t => t.id))
  const available = allTags.filter(t => !assigned.has(t.id))

  const handleAdd = async (tagId: string) => {
    setSaving(tagId)
    try { await onAddTag(tagId) } finally { setSaving(null) }
  }

  const handleRemove = async (tagId: string) => {
    setRemoving(tagId)
    try { await onRemoveTag(tagId) } finally { setRemoving(null) }
  }

  const handleCreate = async () => {
    if (!newNome.trim()) { setCreateError('Nome obbligatorio'); return }
    setCreateLoading(true)
    setCreateError('')
    try {
      const created = await onCreateTag(newNome.trim(), newColore)
      await onAddTag(created.id)
      setNewNome('')
      setNewColore('#378ADD')
      setCreating(false)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setCreateError(err.message || 'Errore')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        {isAdmin && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#d64b55] hover:underline"
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Aggiungi
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <span className="text-xs text-gray-400">Nessun {label.toLowerCase()} assegnato</span>
        ) : (
          tags.map(t => (
            <TagPill
              key={t.id}
              tag={t}
              onRemove={isAdmin ? () => handleRemove(t.id) : undefined}
            />
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setCreating(false); setNewNome(''); setNewColore('#378ADD'); setCreateError('') }}
        title={`Gestisci ${label.toLowerCase()}`}
        size="sm"
        footer={<Button variant="secondary" onClick={() => setOpen(false)}>Chiudi</Button>}
      >
        <div className="space-y-4">
          {/* Available tags */}
          {available.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Seleziona un tag da aggiungere:</p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {available.map(t => (
                  <button
                    key={t.id}
                    disabled={saving === t.id}
                    onClick={() => handleAdd(t.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity disabled:opacity-50 hover:opacity-80"
                    style={{ backgroundColor: t.colore + '22', color: t.colore, border: `1px solid ${t.colore}44` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.colore }} />
                    {t.nome}
                    {saving === t.id && ' …'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {available.length === 0 && !creating && (
            <p className="text-xs text-gray-400">Tutti i tag disponibili sono già assegnati.</p>
          )}

          {/* Assigned */}
          {tags.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Assegnati — clicca × per rimuovere:</p>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <button
                    key={t.id}
                    disabled={removing === t.id}
                    onClick={() => handleRemove(t.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity disabled:opacity-50 hover:opacity-70"
                    style={{ backgroundColor: t.colore + '22', color: t.colore, border: `1px solid ${t.colore}44` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.colore }} />
                    {t.nome}
                    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" className="ml-0.5">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    {removing === t.id && ' …'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create new tag inline */}
          <div className="border-t border-gray-100 pt-3">
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                + Crea nuovo tag
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Nuovo tag</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label=""
                      value={newNome}
                      onChange={e => setNewNome(e.target.value)}
                      placeholder="Nome tag"
                    />
                  </div>
                  <div className="shrink-0">
                    <label className="block text-xs text-gray-500 mb-1">Colore</label>
                    <input
                      type="color"
                      value={newColore}
                      onChange={e => setNewColore(e.target.value)}
                      className="w-10 h-9 border border-gray-200 rounded-[7px] cursor-pointer p-0.5"
                    />
                  </div>
                </div>
                {createError && <p className="text-xs text-red-500">{createError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} loading={createLoading} disabled={!newNome.trim()}>Crea e aggiungi</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewNome(''); setCreateError('') }}>Annulla</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
