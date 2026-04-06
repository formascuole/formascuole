'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProgettoConStats, CorsoConOre, Profile } from '@/lib/types'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Avatar } from '@/components/ui/Avatar'

interface ProgettoDetailClientProps {
  progetto: ProgettoConStats
  corsi: CorsoConOre[]
  formatori: Profile[]
}

export function ProgettoDetailClient({ progetto, corsi, formatori }: ProgettoDetailClientProps) {
  const router = useRouter()
  const [addCorsoOpen, setAddCorsoOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [corsoForm, setCorsoForm] = useState({ title: '', tipo: 'PF', ore_totali: '' })
  const pct = Number(progetto.percentuale_completamento)

  const handleAddCorso = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/corsi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: progetto.id,
          title: corsoForm.title,
          tipo: corsoForm.tipo,
          ore_totali: Number(corsoForm.ore_totali),
        }),
      })
      if (res.ok) {
        setAddCorsoOpen(false)
        setCorsoForm({ title: '', tipo: 'PF', ore_totali: '' })
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/progetti" className="hover:text-gray-700">Progetti</Link>
        <span>/</span>
        <span className="text-gray-700">{progetto.school_name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{progetto.school_name}</h1>
              <StatusBadge variant={progetto.status} />
            </div>
            <p className="text-sm text-gray-500">{progetto.address} · {progetto.anno_scolastico}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">REFERENTE</div>
            <div className="font-medium text-sm text-gray-800">{progetto.ref_name}</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">EMAIL</div>
            <a href={`mailto:${progetto.ref_email}`} className="text-sm text-blue-600 hover:underline">{progetto.ref_email}</a>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-400 text-xs mb-1">TELEFONO</div>
            <div className="text-sm text-gray-800">{progetto.ref_tel || '—'}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Progresso ore complessive</span>
            <span className="font-semibold text-gray-700">{progetto.ore_pianificate}h / {progetto.ore_totali}h ({pct}%)</span>
          </div>
          <ProgressBar value={pct} size="lg" />
        </div>
      </div>

      {/* Alert */}
      {(Number(progetto.corsi_senza_formatore) > 0 || Number(progetto.corsi_senza_calendario) > 0) && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="text-amber-500 shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="text-sm text-amber-800">
            {Number(progetto.corsi_senza_formatore) > 0 && (
              <div>{progetto.corsi_senza_formatore} cors{Number(progetto.corsi_senza_formatore) > 1 ? 'i' : 'o'} senza formatore assegnato.</div>
            )}
            {Number(progetto.corsi_senza_calendario) > 0 && (
              <div>{progetto.corsi_senza_calendario} cors{Number(progetto.corsi_senza_calendario) > 1 ? 'i' : 'o'} con formatore ma senza calendario completo.</div>
            )}
          </div>
        </div>
      )}

      {/* Corsi */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Corsi ({corsi.length})</h2>
          <Button size="sm" onClick={() => setAddCorsoOpen(true)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Aggiungi Corso
          </Button>
        </div>

        <div className="divide-y divide-gray-50">
          {corsi.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Nessun corso aggiunto. Clicca &quot;Aggiungi Corso&quot; per iniziare.
            </div>
          ) : (
            corsi.map((corso) => (
              <CourseRow key={corso.id} corso={corso} progettoId={progetto.id} />
            ))
          )}
        </div>
      </div>

      {/* Add corso modal */}
      <Modal
        open={addCorsoOpen}
        onClose={() => setAddCorsoOpen(false)}
        title="Aggiungi Corso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddCorsoOpen(false)}>Annulla</Button>
            <Button onClick={handleAddCorso} loading={saving} disabled={!corsoForm.title || !corsoForm.ore_totali}>
              Aggiungi
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Titolo corso *" value={corsoForm.title} onChange={e => setCorsoForm(f => ({ ...f, title: e.target.value }))} placeholder="Es. Sicurezza sul lavoro" />
          <Select
            label="Tipo *"
            value={corsoForm.tipo}
            onChange={e => setCorsoForm(f => ({ ...f, tipo: e.target.value }))}
            options={[
              { value: 'PF', label: 'Percorso Formativo (PF)' },
              { value: 'Lab', label: 'Laboratorio sul Campo (Lab)' },
            ]}
          />
          <Input label="Ore totali *" type="number" min={1} value={corsoForm.ore_totali} onChange={e => setCorsoForm(f => ({ ...f, ore_totali: e.target.value }))} placeholder="Es. 20" />
        </div>
      </Modal>
    </div>
  )
}

function CourseRow({ corso, progettoId }: { corso: CorsoConOre; progettoId: string }) {
  const router = useRouter()
  const pct = corso.ore_totali > 0 ? Math.min(Math.round((corso.ore_pianificate / corso.ore_totali) * 100), 100) : 0
  const formatore = corso.formatore as Profile | undefined

  return (
    <div
      className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => router.push(`/progetti/${progettoId}/corsi/${corso.id}`)}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">{corso.title}</span>
            <StatusBadge variant={corso.tipo} size="sm" />
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{corso.ore_totali}h totali</span>
            <span>{corso.ore_pianificate}h pianificate</span>
            {corso.calendario_completo && (
              <span className="text-green-600 flex items-center gap-1">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Completo
              </span>
            )}
          </div>
        </div>

        <div className="w-36">
          <ProgressBar value={pct} size="sm" showLabel />
        </div>

        <div className="w-40 shrink-0">
          {formatore ? (
            <div className="flex items-center gap-2">
              <Avatar nome={formatore.nome} id={formatore.id} initials={formatore.avatar_initials} size="sm" />
              <span className="text-xs text-gray-700 truncate">{formatore.nome}</span>
            </div>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-[7px]">
              Nessun formatore
            </span>
          )}
        </div>

        <svg className="text-gray-300" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}
