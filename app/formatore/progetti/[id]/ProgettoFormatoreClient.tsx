'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CorsoConOre } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'

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

type ReferenteInfo = { id: string; nome: string; email: string; tel?: string } | null
interface CorsoConReferente extends Omit<CorsoConOre, 'referente'> {
  referente?: ReferenteInfo
}

interface ProgettoInfo {
  id: string
  school_name: string
  address?: string
  ref_name: string
  ref_email: string
  ref_tel?: string
  finanziamento_id?: string | null
}

interface Props {
  progetto: ProgettoInfo
  corsi: CorsoConReferente[]
  finanziamenti: { id: string; nome: string }[]
}

export function ProgettoFormatoreClient({ progetto, corsi, finanziamenti }: Props) {
  const router = useRouter()
  const [selectedCorso, setSelectedCorso] = useState<CorsoConReferente | null>(null)
  const [sessioni, setSessioni] = useState<{ id: string; data: string; ore: number; created_at: string }[]>([])
  const [loadingSessioni, setLoadingSessioni] = useState(false)
  const [newData, setNewData] = useState('')
  const [newOre, setNewOre] = useState('')
  const [saving, setSaving] = useState(false)

  const finNome = progetto.finanziamento_id ? finanziamenti.find(f => f.id === progetto.finanziamento_id)?.nome : null
  const color = finNome ? badgeColor(finNome) : null

  // Per il referente: usa il referente specifico del primo corso se presente
  const refCorso = corsi.find(c => c.referente)?.referente
  const refNome = refCorso?.nome || progetto.ref_name
  const refEmail = refCorso?.email || progetto.ref_email
  const refTel = refCorso?.tel || progetto.ref_tel

  const openModal = async (corso: CorsoConReferente) => {
    setSelectedCorso(corso)
    setLoadingSessioni(true)
    const res = await fetch(`/api/sessioni?corso_id=${corso.id}`)
    setSessioni((await res.json()) || [])
    setLoadingSessioni(false)
  }

  const oreResidue = selectedCorso
    ? Math.max(Number(selectedCorso.ore_totali) - Number(selectedCorso.ore_pianificate), 0)
    : 0
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
        const updated = await fetch(`/api/sessioni?corso_id=${selectedCorso.id}`)
        setSessioni((await updated.json()) || [])
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/formatore/progetti"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors"
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Tutti i progetti
      </Link>

      {/* Header progetto */}
      <div className="bg-white rounded-xl px-5 py-5 mb-6" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">{progetto.school_name}</h1>
              {finNome && color && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: color.bg, color: color.text }}
                >
                  {finNome}
                </span>
              )}
            </div>
            {progetto.address && <p className="text-sm text-gray-400">{progetto.address}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-medium text-gray-500">{corsi.length} cors{corsi.length === 1 ? 'o' : 'i'}</div>
          </div>
        </div>

        {/* Referente */}
        <div className="flex items-start gap-2 text-sm bg-gray-50 rounded-[7px] px-4 py-3">
          <svg className="text-gray-400 mt-0.5 shrink-0" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <span className="font-medium text-gray-700">{refNome}</span>
            <span className="text-gray-400 mx-2">·</span>
            <a href={`mailto:${refEmail}`} className="text-blue-600 hover:underline">{refEmail}</a>
            {refTel && (
              <>
                <span className="text-gray-400 mx-2">·</span>
                <a href={`tel:${refTel}`} className="text-gray-500 hover:text-gray-700">{refTel}</a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Corsi */}
      <div className="space-y-3">
        {corsi.map(corso => {
          const oreTot = Number(corso.ore_totali)
          const orePian = Number(corso.ore_pianificate)
          const oreRes = Math.max(oreTot - orePian, 0)
          const pct = oreTot > 0 ? Math.min(Math.round((orePian / oreTot) * 100), 100) : 0
          const stato = corso.calendario_completo
            ? { label: 'Completato', bg: '#dcfce7', text: '#166534' }
            : orePian === 0
            ? { label: 'Da pianificare', bg: '#f3f4f6', text: '#6b7280' }
            : { label: 'In corso', bg: '#dbeafe', text: '#1e40af' }

          return (
            <div key={corso.id} className="bg-white rounded-xl px-5 py-4" style={{ border: '0.5px solid #e5e5e5' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className="font-semibold text-gray-900">{corso.title}</h3>
                    <StatusBadge variant={corso.tipo} size="sm" />
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: stato.bg, color: stato.text }}
                    >
                      {stato.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{oreTot}h totali</span>
                    <span>{orePian}h pianificate</span>
                    <span className={oreRes > 0 ? 'font-medium text-gray-600' : 'text-gray-400'}>
                      {oreRes}h residue
                    </span>
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

      {/* Calendario modal */}
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
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Sessioni pianificate ({sessioni.length})
                </h4>
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
