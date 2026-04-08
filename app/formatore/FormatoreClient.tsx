'use client'
import { useMemo, useState } from 'react'
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

// Palette colori per badge finanziamento (stessa logica di ProgettiClient)
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
function badgeColor(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0x7fffffff
  return BADGE_PALETTE[h % BADGE_PALETTE.length]
}

type ProgettoInfo = {
  id: string
  school_name: string
  address?: string
  anno_scolastico?: string
  ref_name: string
  ref_email: string
  ref_tel?: string
  finanziamento_id?: string | null
}

type ReferenteInfo = { id: string; nome: string; email: string; tel?: string } | null

interface CorsoConProgetto extends Omit<CorsoConOre, 'referente'> {
  progetti?: ProgettoInfo
  referente?: ReferenteInfo
}

interface FormatoreClientProps {
  corsi: CorsoConProgetto[]
  profile: Profile
  finanziamenti: { id: string; nome: string }[]
}

export function FormatoreClient({ corsi, profile, finanziamenti }: FormatoreClientProps) {
  const router = useRouter()
  const [selectedCorso, setSelectedCorso] = useState<CorsoConProgetto | null>(null)
  const [sessioni, setSessioni] = useState<{ id: string; data: string; ore: number; created_at: string }[]>([])
  const [loadingSessioni, setLoadingSessioni] = useState(false)
  const [newData, setNewData] = useState('')
  const [newOre, setNewOre] = useState('')
  const [saving, setSaving] = useState(false)

  const totalOre = corsi.reduce((s, c) => s + Number(c.ore_totali), 0)
  const totalPianificate = corsi.reduce((s, c) => s + Number(c.ore_pianificate), 0)
  const pctGlobale = totalOre > 0 ? Math.round((totalPianificate / totalOre) * 100) : 0

  // Raggruppa corsi per progetto
  const byProgetto = useMemo(() => {
    const map = new Map<string, { progetto: ProgettoInfo; corsi: CorsoConProgetto[] }>()
    for (const corso of corsi) {
      const pid = corso.project_id
      if (!map.has(pid)) map.set(pid, { progetto: corso.progetti!, corsi: [] })
      map.get(pid)!.corsi.push(corso)
    }
    return [...map.values()]
  }, [corsi])

  const openModal = async (corso: CorsoConProgetto) => {
    setSelectedCorso(corso)
    setLoadingSessioni(true)
    const res = await fetch(`/api/sessioni?corso_id=${corso.id}`)
    setSessioni((await res.json()) || [])
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

      {/* Corsi raggruppati per progetto */}
      {corsi.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="text-sm text-gray-400">Nessun corso assegnato al momento.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {byProgetto.map(({ progetto, corsi: corsiProgetto }) => {
            if (!progetto) return null
            const fin = progetto.finanziamento_id ? finanziamenti.find(f => f.id === progetto.finanziamento_id) : null
            const color = fin ? badgeColor(fin.nome) : null
            return (
              <div key={progetto.id}>
                {/* Header progetto */}
                <div
                  className="bg-white rounded-xl px-5 py-4 mb-2"
                  style={{ border: '0.5px solid #e5e5e5' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h2 className="font-semibold text-gray-900">{progetto.school_name}</h2>
                        {fin && color && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0"
                            style={{ backgroundColor: color.bg, color: color.text }}
                          >
                            {fin.nome}
                          </span>
                        )}
                      </div>
                      {progetto.address && (
                        <p className="text-xs text-gray-400">{progetto.address}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {corsiProgetto.length} cors{corsiProgetto.length === 1 ? 'o' : 'i'}
                    </span>
                  </div>

                  {/* Referente */}
                  {(() => {
                    // Usa il referente specifico del primo corso se presente, altrimenti il principale del progetto
                    const refCorso = corsiProgetto.find(c => c.referente)?.referente
                    const nome = refCorso?.nome || progetto.ref_name
                    const email = refCorso?.email || progetto.ref_email
                    const tel = refCorso?.tel || progetto.ref_tel
                    return (
                      <div className="flex items-start gap-2 text-xs bg-gray-50 rounded-[7px] px-3 py-2">
                        <svg className="text-gray-400 mt-0.5 shrink-0" width="13" height="13" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <div>
                          <span className="font-medium text-gray-700">{nome}</span>
                          <span className="text-gray-400 mx-1">·</span>
                          <a href={`mailto:${email}`} className="text-blue-600 hover:underline">{email}</a>
                          {tel && <><span className="text-gray-400 mx-1">·</span><span className="text-gray-500">{tel}</span></>}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Corsi del progetto */}
                <div className="space-y-2 pl-3">
                  {corsiProgetto.map(corso => {
                    const pct = corso.ore_totali > 0
                      ? Math.min(Math.round((Number(corso.ore_pianificate) / Number(corso.ore_totali)) * 100), 100)
                      : 0
                    const orePian = Number(corso.ore_pianificate)
                    const oreTot = Number(corso.ore_totali)
                    const stato = corso.calendario_completo
                      ? { label: 'Completato', bg: '#dcfce7', text: '#166534' }
                      : orePian === 0
                      ? { label: 'Da pianificare', bg: '#f3f4f6', text: '#6b7280' }
                      : { label: 'In corso', bg: '#dbeafe', text: '#1e40af' }

                    return (
                      <div
                        key={corso.id}
                        className="bg-white rounded-xl px-5 py-4"
                        style={{ border: '0.5px solid #e5e5e5' }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-medium text-gray-900 text-sm">{corso.title}</h3>
                              <StatusBadge variant={corso.tipo} size="sm" />
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: stato.bg, color: stato.text }}
                              >
                                {stato.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{oreTot}h totali</span>
                              <span>{orePian}h pianificate</span>
                              <span className="font-medium text-gray-600">{pct}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant={corso.calendario_completo ? 'secondary' : 'primary'}
                              onClick={() => openModal(corso)}
                            >
                              {corso.calendario_completo ? 'Vedi calendario' : 'Pianifica'}
                            </Button>
                            <button
                              onClick={() => router.push(`/progetti/${corso.project_id}/corsi/${corso.id}`)}
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
                            >
                              Vai al corso
                              <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <ProgressBar value={pct} size="sm" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

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

            {!selectedCorso.calendario_completo && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Aggiungi sessione</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Data *" type="date" value={newData} onChange={e => setNewData(e.target.value)} />
                  <Input
                    label="Ore *"
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
