'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CorsoConOre, Profile } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

interface CorsoConProgetto extends CorsoConOre {
  progetti?: { school_name: string; anno_scolastico: string; ref_name: string; ref_email: string }
}

interface FormatoreClientProps {
  corsi: CorsoConProgetto[]
  profile: Profile
}

export function FormatoreClient({ corsi, profile }: FormatoreClientProps) {
  const router = useRouter()
  const [selectedCorso, setSelectedCorso] = useState<CorsoConProgetto | null>(null)
  const [sessioni, setSessioni] = useState<{id: string; data: string; ore: number; created_at: string}[]>([])
  const [loadingSessioni, setLoadingSessioni] = useState(false)
  const [newData, setNewData] = useState('')
  const [newOre, setNewOre] = useState('')
  const [saving, setSaving] = useState(false)

  const totalOre = corsi.reduce((s, c) => s + Number(c.ore_totali), 0)
  const totalPianificate = corsi.reduce((s, c) => s + Number(c.ore_pianificate), 0)
  const pctGlobale = totalOre > 0 ? Math.round((totalPianificate / totalOre) * 100) : 0

  const openModal = async (corso: CorsoConProgetto) => {
    setSelectedCorso(corso)
    setLoadingSessioni(true)
    const res = await fetch(`/api/sessioni?corso_id=${corso.id}`)
    const data = await res.json()
    setSessioni(data || [])
    setLoadingSessioni(false)
  }

  const oreResidue = selectedCorso ? Math.max(Number(selectedCorso.ore_totali) - Number(selectedCorso.ore_pianificate), 0) : 0
  const newOreNum = Number(newOre)
  const oreError = newOre && newOreNum > oreResidue ? `Max ${oreResidue}h residue` : ''
  const canSubmit = newData && newOre && !oreError && newOreNum > 0 && oreResidue > 0

  const handleAddSession = async () => {
    if (!selectedCorso) return
    setSaving(true)
    try {
      const res = await fetch('/api/sessioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso_id: selectedCorso.id, data: newData, ore: newOreNum }),
      })
      if (res.ok) {
        setNewData('')
        setNewOre('')
        // Refresh sessioni
        const r2 = await fetch(`/api/sessioni?corso_id=${selectedCorso.id}`)
        setSessioni(await r2.json())
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Avatar nome={profile.nome} id={profile.id} initials={profile.avatar_initials} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ciao, {profile.nome.split(' ')[0]}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Corsi assegnati" value={corsi.length} />
        <StatCard label="Ore totali" value={`${totalOre}h`} subtitle={`${totalPianificate}h pianificate`} />
        <StatCard label="Completamento" value={`${pctGlobale}%`} />
      </div>

      {/* Corsi list */}
      <div className="space-y-3">
        {corsi.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
            <div className="text-sm text-gray-400">Nessun corso assegnato al momento.</div>
          </div>
        ) : (
          corsi.map(corso => {
            const pct = corso.ore_totali > 0 ? Math.min(Math.round((Number(corso.ore_pianificate) / Number(corso.ore_totali)) * 100), 100) : 0
            return (
              <div key={corso.id} className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e5e5' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{corso.title}</h3>
                      <StatusBadge variant={corso.tipo} size="sm" />
                      {corso.calendario_completo && (
                        <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-md font-medium">Completo</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {corso.progetti?.school_name} · {corso.progetti?.anno_scolastico}
                    </div>
                    {corso.progetti?.ref_name && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Referente: {corso.progetti.ref_name} · <a href={`mailto:${corso.progetti.ref_email}`} className="text-blue-500 hover:underline">{corso.progetti.ref_email}</a>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={corso.calendario_completo ? 'secondary' : 'primary'}
                    onClick={() => openModal(corso)}
                  >
                    {corso.calendario_completo ? 'Vedi calendario' : 'Pianifica calendario'}
                  </Button>
                </div>
                <div className="space-y-1">
                  <ProgressBar value={pct} size="sm" showLabel />
                  <div className="text-xs text-gray-400">{corso.ore_pianificate}h / {corso.ore_totali}h</div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Calendar modal */}
      <Modal
        open={!!selectedCorso}
        onClose={() => { setSelectedCorso(null); setNewData(''); setNewOre('') }}
        title={selectedCorso ? `Calendario — ${selectedCorso.title}` : ''}
        size="lg"
      >
        {selectedCorso && (
          <div className="space-y-5">
            <OreCounter
              oreTotali={Number(selectedCorso.ore_totali)}
              orePianificate={Number(selectedCorso.ore_pianificate)}
            />

            {/* Add session form */}
            {!selectedCorso.calendario_completo && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Aggiungi sessione</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Data *" type="date" value={newData} onChange={e => setNewData(e.target.value)} />
                  <Input
                    label={`Ore *`}
                    type="number"
                    min={1}
                    max={oreResidue}
                    value={newOre}
                    onChange={e => setNewOre(e.target.value)}
                    hint={`Max ${oreResidue}h residue`}
                    error={oreError}
                  />
                </div>
                <Button onClick={handleAddSession} loading={saving} disabled={!canSubmit} size="sm">
                  Aggiungi sessione
                </Button>
              </div>
            )}

            {/* Sessioni list */}
            {loadingSessioni ? (
              <div className="text-center py-4 text-sm text-gray-400">Caricamento...</div>
            ) : (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Sessioni pianificate ({sessioni.length})</h4>
                {sessioni.length === 0 ? (
                  <div className="text-sm text-gray-400">Nessuna sessione ancora.</div>
                ) : (
                  <div className="space-y-1.5">
                    {sessioni.map(s => (
                      <div key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-[7px] px-3 py-2 text-sm">
                        <span className="font-medium text-gray-800">{formatDate(s.data)}</span>
                        <span className="text-gray-500">{s.ore}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
