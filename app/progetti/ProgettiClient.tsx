'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ProgettoConStats, Finanziamento } from '@/lib/types'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { GeoSelect } from '@/components/GeoSelect'
import { RUOLI_REFERENTE } from '@/lib/ruolo-referente'
import { RuoloBadge } from '@/components/ui/RuoloBadge'

// Palette colori per badge finanziamento
const BADGE_PALETTE = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#cffafe', text: '#155e75' },
  { bg: '#ffedd5', text: '#9a3412' },
  { bg: '#f0fdf4', text: '#14532d' },
]

export function getFinanziamentoColor(nome: string) {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) & 0x7fffffff
  return BADGE_PALETTE[hash % BADGE_PALETTE.length]
}

/** Format a project address from its geographic components. */
export function formatAddress(p: {
  address?: string | null
  citta?: string | null
  provincia?: string | null
}): string {
  const parts: string[] = []
  if (p.address) parts.push(p.address)
  if (p.citta) parts.push(p.provincia ? `${p.citta} (${p.provincia})` : p.citta)
  return parts.join(', ') || '—'
}

interface ProgettiClientProps {
  progetti: ProgettoConStats[]
  finanziamenti: Finanziamento[]
  inAttesaProjectIds?: string[]
}

export function ProgettiClient({ progetti, finanziamenti, inAttesaProjectIds }: ProgettiClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterFinId, setFilterFinId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState({
    school_name: '',
    address: '',
    regione: '',
    provincia: '',
    citta: '',
    finanziamento_id: '',
    ref_name: '',
    ref_email: '',
    ref_tel: '',
    ref_ruolo: '',
    status: 'active',
  })

  const attivi = finanziamenti.filter(f => f.attivo)

  const inAttesaSet = useMemo(
    () => inAttesaProjectIds ? new Set(inAttesaProjectIds) : null,
    [inAttesaProjectIds]
  )

  const filtered = useMemo(() => {
    let list = progetti
    if (inAttesaSet) {
      list = list.filter(p => inAttesaSet.has(p.id))
    }
    if (filterFinId) {
      list = list.filter(p => (p as ProgettoConStats & { finanziamento_id?: string | null }).finanziamento_id === filterFinId)
    }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(p =>
      p.school_name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      (p.citta ?? '').toLowerCase().includes(q) ||
      (p.anno_scolastico || '').includes(q) ||
      p.ref_name.toLowerCase().includes(q)
    )
  }, [progetti, search, filterFinId, inAttesaSet])

  const resetForm = () => setForm({
    school_name: '', address: '', regione: '', provincia: '', citta: '',
    finanziamento_id: '', ref_name: '', ref_email: '', ref_tel: '', ref_ruolo: '', status: 'active',
  })

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/progetti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          finanziamento_id: form.finanziamento_id || null,
          regione: form.regione || null,
          provincia: form.provincia || null,
          citta: form.citta || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSaveError(json.error || 'Errore durante il salvataggio')
        return
      }
      setModalOpen(false)
      setSaveError('')
      resetForm()
      router.refresh()
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
        <Button onClick={() => { setSaveError(''); setModalOpen(true) }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Nuovo Progetto
        </Button>
      </div>

      {/* Banner filtro in attesa */}
      {inAttesaSet && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="text-amber-500 shrink-0" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm text-amber-800 flex-1">
            Filtro attivo: {inAttesaSet.size} progett{inAttesaSet.size === 1 ? 'o' : 'i'} con corsi in attesa di accettazione
          </span>
          <a href="/progetti" className="text-xs font-medium text-amber-700 hover:underline">Rimuovi filtro</a>
        </div>
      )}

      {/* Search + filtro finanziamento */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per scuola, indirizzo, referente..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-[7px] focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
          />
        </div>
        {finanziamenti.length > 0 && (
          <select
            value={filterFinId}
            onChange={e => setFilterFinId(e.target.value)}
            className="text-sm border border-gray-200 rounded-[7px] px-3 py-2 bg-white focus:outline-none focus:border-[#d64b55] transition-colors"
          >
            <option value="">Tutti i finanziamenti</option>
            {finanziamenti.map(f => (
              <option key={f.id} value={f.id}>{f.nome}{!f.attivo ? ' (inattivo)' : ''}</option>
            ))}
          </select>
        )}
        {(search || filterFinId) && (
          <span className="text-xs text-gray-400">{filtered.length} risultat{filtered.length === 1 ? 'o' : 'i'}</span>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="mx-auto mb-4 text-gray-300" width="48" height="48" fill="none" viewBox="0 0 24 24">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <p className="text-sm">Nessun progetto trovato</p>
          {(search || filterFinId) && <p className="text-xs mt-1">Prova a modificare i filtri</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard key={p.id} progetto={p} finanziamenti={finanziamenti} />
          ))}
        </div>
      )}

      {/* Modal nuovo progetto */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSaveError('') }}
        title="Nuovo Progetto"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.school_name || !form.ref_name || !form.ref_email}>
              Crea Progetto
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome scuola *" value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} placeholder="Es. ITIS G. Marconi" />
          <Input label="Via e civico" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Via Roma 1" />
          <GeoSelect
            regione={form.regione}
            provincia={form.provincia}
            citta={form.citta}
            onRegioneChange={v => setForm(f => ({ ...f, regione: v }))}
            onProvinciaChange={v => setForm(f => ({ ...f, provincia: v }))}
            onCittaChange={v => setForm(f => ({ ...f, citta: v }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Finanziamento</label>
            <select
              value={form.finanziamento_id}
              onChange={e => setForm(f => ({ ...f, finanziamento_id: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 bg-white focus:outline-none focus:border-[#d64b55] transition-colors"
            >
              <option value="">Nessun finanziamento</option>
              {attivi.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome referente *" value={form.ref_name} onChange={e => setForm(f => ({ ...f, ref_name: e.target.value }))} />
            <Input label="Email referente *" type="email" value={form.ref_email} onChange={e => setForm(f => ({ ...f, ref_email: e.target.value }))} />
          </div>
          <Input label="Telefono referente" type="tel" value={form.ref_tel} onChange={e => setForm(f => ({ ...f, ref_tel: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo referente</label>
            <select value={form.ref_ruolo} onChange={e => setForm(f => ({ ...f, ref_ruolo: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Seleziona ruolo —</option>
              {RUOLI_REFERENTE.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
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
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </div>
      </Modal>
    </div>
  )
}

function ProjectCard({ progetto: p, finanziamenti }: { progetto: ProgettoConStats; finanziamenti: Finanziamento[] }) {
  const router = useRouter()
  const hasWarning = Number(p.corsi_senza_formatore) > 0 || Number(p.corsi_senza_calendario) > 0
  const fin_id = (p as ProgettoConStats & { finanziamento_id?: string | null }).finanziamento_id
  const finanziamento = fin_id ? finanziamenti.find(f => f.id === fin_id) : null
  const color = finanziamento ? getFinanziamentoColor(finanziamento.nome) : null

  return (
    <div
      className="bg-white rounded-xl p-5 cursor-pointer hover:shadow-md transition-all"
      style={{ border: '0.5px solid #e5e5e5' }}
      onClick={() => router.push(`/progetti/${p.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{p.school_name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{formatAddress(p)}</p>
        </div>
        <StatusBadge variant={p.status} size="sm" />
      </div>

      <div className="text-xs text-gray-500 mb-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {p.ref_name}
          {p.ref_ruolo && <RuoloBadge ruolo={p.ref_ruolo} />}
        </div>
        {finanziamento && color ? (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block text-xs font-medium px-2 py-0.5 rounded-md"
              style={{ backgroundColor: color.bg, color: color.text }}
            >
              {finanziamento.nome}
            </span>
          </div>
        ) : p.anno_scolastico ? (
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {p.anno_scolastico}
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {p.n_corsi} cors{Number(p.n_corsi) === 1 ? 'o' : 'i'}
        </div>
      </div>

      <div>
        <DualProgressBar oreTotali={Number(p.ore_totali)} orePianificate={Number(p.ore_pianificate)} oreErogate={Number(p.ore_erogate)} size="sm" />
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
