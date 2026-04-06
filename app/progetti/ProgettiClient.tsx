'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ProgettoConStats } from '@/lib/types'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface ProgettiClientProps {
  progetti: ProgettoConStats[]
}

export function ProgettiClient({ progetti }: ProgettiClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    school_name: '',
    address: '',
    anno_scolastico: '',
    ref_name: '',
    ref_email: '',
    ref_tel: '',
    status: 'active',
  })

  const filtered = useMemo(() =>
    progetti.filter(p =>
      p.school_name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.anno_scolastico.includes(search)
    ), [progetti, search])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/progetti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setModalOpen(false)
        setForm({ school_name: '', address: '', anno_scolastico: '', ref_name: '', ref_email: '', ref_tel: '', status: 'active' })
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Progetti</h1>
          <p className="text-sm text-gray-500 mt-1">{progetti.length} progett{progetti.length === 1 ? 'o' : 'i'} totali</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Nuovo Progetto
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Cerca per scuola, indirizzo, anno..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="mx-auto mb-4 text-gray-300" width="48" height="48" fill="none" viewBox="0 0 24 24">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <p className="text-sm">Nessun progetto trovato</p>
          {search && <p className="text-xs mt-1">Prova a modificare la ricerca</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard key={p.id} progetto={p} />
          ))}
        </div>
      )}

      {/* Modal nuovo progetto */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuovo Progetto"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.school_name || !form.anno_scolastico || !form.ref_name || !form.ref_email}>
              Crea Progetto
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome scuola *" value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} placeholder="Es. ITIS G. Marconi" />
          <Input label="Indirizzo *" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Via Roma 1, Milano" />
          <Input label="Anno scolastico *" value={form.anno_scolastico} onChange={e => setForm(f => ({ ...f, anno_scolastico: e.target.value }))} placeholder="2024-2025" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome referente *" value={form.ref_name} onChange={e => setForm(f => ({ ...f, ref_name: e.target.value }))} />
            <Input label="Email referente *" type="email" value={form.ref_email} onChange={e => setForm(f => ({ ...f, ref_email: e.target.value }))} />
          </div>
          <Input label="Telefono referente" type="tel" value={form.ref_tel} onChange={e => setForm(f => ({ ...f, ref_tel: e.target.value }))} />
          <Select
            label="Stato"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'active', label: 'Attivo' },
              { value: 'pending', label: 'In attesa' },
              { value: 'completed', label: 'Completato' },
            ]}
          />
        </div>
      </Modal>
    </div>
  )
}

function ProjectCard({ progetto: p }: { progetto: ProgettoConStats }) {
  const router = useRouter()
  const pct = Number(p.percentuale_completamento)
  const hasWarning = Number(p.corsi_senza_formatore) > 0 || Number(p.corsi_senza_calendario) > 0

  return (
    <div
      className="bg-white rounded-xl p-5 cursor-pointer hover:shadow-md transition-all"
      style={{ border: '0.5px solid #e5e5e5' }}
      onClick={() => router.push(`/progetti/${p.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{p.school_name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{p.address}</p>
        </div>
        <StatusBadge variant={p.status} size="sm" />
      </div>

      <div className="text-xs text-gray-500 mb-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {p.ref_name}
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {p.anno_scolastico}
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {p.n_corsi} cors{Number(p.n_corsi) === 1 ? 'o' : 'i'}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Ore pianificate</span>
          <span className="font-medium text-gray-700">{pct}%</span>
        </div>
        <ProgressBar value={pct} size="sm" />
        <div className="text-xs text-gray-400">{p.ore_pianificate}h / {p.ore_totali}h</div>
      </div>

      {hasWarning && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-[7px] px-2.5 py-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {Number(p.corsi_senza_formatore) > 0 && `${p.corsi_senza_formatore} senza formatore`}
          {Number(p.corsi_senza_formatore) > 0 && Number(p.corsi_senza_calendario) > 0 && ', '}
          {Number(p.corsi_senza_calendario) > 0 && `${p.corsi_senza_calendario} senza calendario`}
        </div>
      )}
    </div>
  )
}
