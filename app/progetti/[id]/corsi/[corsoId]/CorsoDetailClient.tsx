'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CorsoConOre, Sessione, Profile, Progetto } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

interface CorsoDetailClientProps {
  corso: CorsoConOre & { formatore?: Profile }
  progetto: Pick<Progetto, 'school_name' | 'anno_scolastico' | 'ref_name' | 'ref_email'> | null
  sessioni: Sessione[]
  formatori: Profile[]
  progettoId: string
}

export function CorsoDetailClient({ corso, progetto, sessioni, formatori, progettoId }: CorsoDetailClientProps) {
  const router = useRouter()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [formatorePickerOpen, setFormatorePickerOpen] = useState(false)
  const [newData, setNewData] = useState('')
  const [newOre, setNewOre] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const orePianificate = Number(corso.ore_pianificate)
  const oreResidue = Math.max(Number(corso.ore_totali) - orePianificate, 0)
  const newOreNum = Number(newOre)
  const oreError = newOre && newOreNum > oreResidue ? `Max ${oreResidue}h residue` : ''
  const canSubmitSession = newData && newOre && !oreError && newOreNum > 0 && oreResidue > 0

  const handleAddSession = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sessioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso_id: corso.id, data: newData, ore: newOreNum }),
      })
      if (res.ok) {
        setCalendarOpen(false)
        setNewData('')
        setNewOre('')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSession = async (sessioneId: string) => {
    setDeletingId(sessioneId)
    try {
      await fetch(`/api/sessioni/${sessioneId}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const handleAssignFormatore = async (formatoreId: string) => {
    setAssigningId(formatoreId)
    try {
      const res = await fetch(`/api/corsi/${corso.id}/formatore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formatore_id: formatoreId }),
      })
      if (res.ok) {
        setFormatorePickerOpen(false)
        router.refresh()
      }
    } finally {
      setAssigningId(null)
    }
  }

  const handleRemoveFormatore = async () => {
    await fetch(`/api/corsi/${corso.id}/formatore`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formatore_id: null }),
    })
    router.refresh()
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
        <Link href="/progetti" className="hover:text-gray-700">Progetti</Link>
        <span>/</span>
        <Link href={`/progetti/${progettoId}`} className="hover:text-gray-700">{progetto?.school_name || 'Progetto'}</Link>
        <span>/</span>
        <span className="text-gray-700">{corso.title}</span>
      </div>

      {/* Course header */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{corso.title}</h1>
            <StatusBadge variant={corso.tipo} />
            {corso.calendario_completo && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-md font-medium">
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Calendario completo
              </span>
            )}
          </div>
        </div>
        <OreCounter oreTotali={Number(corso.ore_totali)} orePianificate={orePianificate} />
      </div>

      {/* Formatore */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <h2 className="font-semibold text-gray-900 mb-4">Formatore assegnato</h2>
        {corso.formatore ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar nome={corso.formatore.nome} id={corso.formatore.id} initials={corso.formatore.avatar_initials} size="lg" />
              <div>
                <div className="font-medium text-gray-900">{corso.formatore.nome}</div>
                <a href={`mailto:${corso.formatore.email}`} className="text-sm text-blue-600 hover:underline">{corso.formatore.email}</a>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setFormatorePickerOpen(true)}>Cambia</Button>
              <Button variant="danger" size="sm" onClick={handleRemoveFormatore}>Rimuovi</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-gray-400">Nessun formatore assegnato a questo corso.</p>
            <Button size="sm" onClick={() => setFormatorePickerOpen(true)}>Assegna Formatore</Button>
          </div>
        )}
      </div>

      {/* Sessioni */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Sessioni pianificate ({sessioni.length})</h2>
          <Button
            size="sm"
            onClick={() => setCalendarOpen(true)}
            disabled={oreResidue === 0}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Aggiungi Sessione
          </Button>
        </div>

        {sessioni.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            Nessuna sessione pianificata.
            {oreResidue > 0 && (
              <div className="mt-1 text-xs">Clicca &quot;Aggiungi Sessione&quot; per iniziare.</div>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">DATA</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ORE</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">CREATA IL</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sessioni.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-800">{formatDate(s.data)}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">{s.ore}h</td>
                  <td className="px-6 py-3 text-xs text-gray-400">{formatDate(s.created_at)}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      disabled={deletingId === s.id}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingId === s.id ? 'Eliminando...' : 'Elimina'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Calendar Modal */}
      <Modal
        open={calendarOpen}
        onClose={() => { setCalendarOpen(false); setNewData(''); setNewOre('') }}
        title="Aggiungi Sessione"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCalendarOpen(false); setNewData(''); setNewOre('') }}>Annulla</Button>
            <Button onClick={handleAddSession} loading={saving} disabled={!canSubmitSession}>
              Aggiungi Sessione
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <OreCounter oreTotali={Number(corso.ore_totali)} orePianificate={orePianificate} />
          <Input
            label="Data sessione *"
            type="date"
            value={newData}
            onChange={e => setNewData(e.target.value)}
          />
          <Input
            label={`Ore *`}
            type="number"
            min={1}
            max={oreResidue}
            value={newOre}
            onChange={e => setNewOre(e.target.value)}
            hint={oreResidue > 0 ? `Max ${oreResidue}h residue` : 'Ore residue esaurite'}
            error={oreError}
            placeholder={`Es. ${Math.min(oreResidue, 4)}`}
          />
          {oreResidue === 0 && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-[7px] px-3 py-2">
              Calendario completo! Tutte le ore sono state pianificate.
            </div>
          )}
        </div>
      </Modal>

      {/* Formatore Picker Modal */}
      <Modal
        open={formatorePickerOpen}
        onClose={() => setFormatorePickerOpen(false)}
        title="Seleziona Formatore"
        size="md"
      >
        <div className="grid grid-cols-1 gap-3">
          {formatori.map((f) => (
            <button
              key={f.id}
              onClick={() => handleAssignFormatore(f.id)}
              disabled={assigningId === f.id || f.id === corso.formatore_id}
              className="flex items-center gap-3 p-3 rounded-[7px] border text-left transition-all hover:border-[#d64b55] hover:bg-[#fbeced] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: f.id === corso.formatore_id ? '#d64b55' : '#e5e5e5',
                backgroundColor: f.id === corso.formatore_id ? '#fbeced' : 'white',
              }}
            >
              <Avatar nome={f.nome} id={f.id} initials={f.avatar_initials} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{f.nome}</div>
                <div className="text-xs text-gray-400">{f.email}</div>
              </div>
              {f.id === corso.formatore_id && (
                <span className="text-xs text-[#d64b55] font-medium">Corrente</span>
              )}
              {assigningId === f.id && (
                <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </button>
          ))}
          {formatori.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nessun formatore disponibile.</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
