'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Partner } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fmtCur } from '@/lib/economia-utils'
import type { PartnerProgettoDato } from './page'

const STATUS_LABEL: Record<string, string> = { active: 'Attivo', pending: 'In attesa', completed: 'Concluso' }
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-gray-100 text-gray-500',
}

interface Props {
  partners: Partner[]
  partnerProgetti: Record<string, PartnerProgettoDato[]>
}

export function PartnersClient({ partners: initialPartners, partnerProgetti }: Props) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners)

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

  // Projects detail modal
  const [progettiModal, setProgettiModal] = useState<Partner | null>(null)

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

  const handleExportProgetti = async (partner: Partner, lista: PartnerProgettoDato[]) => {
    const XLSX = await import('xlsx')
    const anno = new Date().getFullYear()
    const filename = `Commissioni_${partner.nome.replace(/\s+/g, '_')}_${anno}.xlsx`
    const headers = ['Progetto', 'Stato', 'Finanziamento', 'Fatturato scuola (€)', 'Commissione IVA inc. (€)', 'Di cui imponibile (€)', 'Di cui IVA 22% (€)']
    const rows = lista.map(p => [
      p.school_name,
      STATUS_LABEL[p.status] ?? p.status,
      p.finanziamento_nome ?? '',
      p.fatturato_scuola,
      p.commissione_totale_ivato,
      p.commissione_imponibile,
      p.commissione_iva,
    ])
    rows.push([
      'TOTALE', '', '',
      lista.reduce((s, p) => s + p.fatturato_scuola, 0),
      lista.reduce((s, p) => s + p.commissione_totale_ivato, 0),
      lista.reduce((s, p) => s + p.commissione_imponibile, 0),
      lista.reduce((s, p) => s + p.commissione_iva, 0),
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 16) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Commissioni')
    XLSX.writeFile(wb, filename)
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
                const progetti = partnerProgetti[p.id] ?? []
                const nProgetti = progetti.length
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
                        <button
                          onClick={() => setProgettiModal(p)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md hover:bg-violet-100 transition-colors"
                        >
                          {nProgetti} progett{nProgetti === 1 ? 'o' : 'i'}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="opacity-50">
                            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
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

      {/* Modal: Aggiungi partner */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Aggiungi partner" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} loading={adding} disabled={!addNome.trim()}>Aggiungi</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nome partner *" value={addNome} onChange={e => setAddNome(e.target.value)}
            placeholder="Es. Fondazione XYZ" autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && addNome.trim()) handleAdd() }}
          />
          {addError && <p className="text-sm text-red-600">{addError}</p>}
        </div>
      </Modal>

      {/* Modal: Rinomina partner */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Rinomina partner" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Annulla</Button>
            <Button onClick={handleEdit} loading={saving} disabled={!editNome.trim()}>Salva</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nome partner *" value={editNome} onChange={e => setEditNome(e.target.value)}
            autoFocus onKeyDown={e => { if (e.key === 'Enter' && editNome.trim()) handleEdit() }}
          />
          {editError && <p className="text-sm text-red-600">{editError}</p>}
        </div>
      </Modal>

      {/* Modal: Conferma eliminazione */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Elimina partner" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button onClick={handleDelete} loading={deleting} style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}>
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

      {/* Modal: Dettaglio progetti del partner */}
      {progettiModal && (() => {
        const lista = partnerProgetti[progettiModal.id] ?? []
        const totFatturato = lista.reduce((s, p) => s + p.fatturato_scuola, 0)
        const totComm = lista.reduce((s, p) => s + p.commissione_totale_ivato, 0)
        return (
          <Modal
            open
            onClose={() => setProgettiModal(null)}
            title={`Progetti — ${progettiModal.nome}`}
            size="lg"
            footer={
              <>
                <button
                  onClick={() => handleExportProgetti(progettiModal, lista)}
                  className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-[7px] border border-gray-200 hover:border-gray-300 bg-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Esporta Excel
                </button>
                <Button variant="secondary" onClick={() => setProgettiModal(null)}>Chiudi</Button>
              </>
            }
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[13px] min-w-[520px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 px-2 py-2 min-w-[140px]">PROGETTO</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-2 py-2">STATO</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-2 py-2 hidden sm:table-cell">FINANZIAMENTO</th>
                    <th className="text-right text-xs font-medium text-blue-400 px-2 py-2">FATTURATO</th>
                    <th className="text-right text-xs font-medium text-emerald-500 px-2 py-2">COMMISSIONE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lista.map(prog => (
                    <tr key={prog.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2.5 font-medium leading-tight">
                        <Link href={`/progetti/${prog.id}`} className="text-gray-800 hover:text-blue-600 hover:underline">
                          {prog.school_name}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-md ${STATUS_CLASS[prog.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[prog.status] ?? prog.status}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 hidden sm:table-cell">
                        {prog.finanziamento_nome ? (
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                            {prog.finanziamento_nome}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-blue-700">
                        {prog.fatturato_scuola > 0
                          ? fmtCur(prog.fatturato_scuola)
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {prog.commissione_totale_ivato > 0 ? (
                          <div>
                            <div className="font-mono font-semibold text-emerald-700">{fmtCur(prog.commissione_totale_ivato)}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              imp.&nbsp;{fmtCur(prog.commissione_imponibile)} · iva&nbsp;{fmtCur(prog.commissione_iva)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={2} className="px-2 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide sm:hidden">
                      Totale
                    </td>
                    <td colSpan={3} className="px-2 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden sm:table-cell">
                      Totale
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold text-blue-800 hidden sm:table-cell">
                      {fmtCur(totFatturato)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold text-emerald-800">
                      {fmtCur(totComm)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
