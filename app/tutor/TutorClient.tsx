'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CorsoConOre, NotaCorso, Profile } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate, telHref } from '@/lib/utils'

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
  formatore?: Profile
  referente?: ReferenteInfo
}

interface TutorClientProps {
  corsi: CorsoConProgetto[]
  profile: Profile
  finanziamenti: { id: string; nome: string }[]
  oreErogate?: number
  oreErogatePerCorso?: Record<string, number>
}

export function TutorClient({ corsi, profile, finanziamenti, oreErogate = 0, oreErogatePerCorso = {} }: TutorClientProps) {
  const router = useRouter()
  const [selectedCorso, setSelectedCorso] = useState<CorsoConProgetto | null>(null)
  const [note, setNote] = useState<NotaCorso[]>([])
  const [loadingNote, setLoadingNote] = useState(false)
  const [newNota, setNewNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)
  const [deletingNota, setDeletingNota] = useState<string | null>(null)

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
    setLoadingNote(true)
    try {
      const res = await fetch(`/api/note?corso_id=${corso.id}`)
      if (res.ok) setNote((await res.json()) || [])
    } finally {
      setLoadingNote(false)
    }
  }

  const handleAddNota = async () => {
    if (!selectedCorso || !newNota.trim()) return
    setSavingNota(true)
    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso_id: selectedCorso.id, testo: newNota.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setNote(prev => [...prev, data])
        setNewNota('')
        router.refresh()
      }
    } finally {
      setSavingNota(false)
    }
  }

  const handleDeleteNota = async (notaId: string) => {
    setDeletingNota(notaId)
    try {
      await fetch(`/api/note/${notaId}`, { method: 'DELETE' })
      setNote(prev => prev.filter(n => n.id !== notaId))
    } finally {
      setDeletingNota(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Avatar nome={profile.nome} id={profile.id} initials={profile.avatar_initials} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ciao, {profile.nome.split(' ')[0]}</h1>
          <p className="text-sm text-gray-500">{profile.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Corsi assegnati"
          value={corsi.length}
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <StatCard
          label="Ore totali"
          value={`${totalOre}h`}
          subtitle={`${totalPianificate}h pianificate`}
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <StatCard
          label="Ore erogate"
          value={`${oreErogate}h`}
          subtitle="sessioni confermate"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <StatCard
          label="Avanzamento"
          value={`${pctGlobale}%`}
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>

      {/* Corsi raggruppati per progetto */}
      {corsi.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <h3 className="font-semibold text-gray-700 mb-1">Nessun corso assegnato</h3>
          <p className="text-sm text-gray-400">Contatta l&apos;amministratore per l&apos;assegnazione</p>
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
                <div className="bg-white rounded-xl px-5 py-4 mb-2" style={{ border: '0.5px solid #e5e5e5' }}>
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
                          {tel && <><span className="text-gray-400 mx-1">·</span><a href={`tel:${telHref(tel)}`} className="text-blue-600 hover:underline">{tel}</a></>}
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
                    const oreEro = oreErogatePerCorso[corso.id] ?? 0
                    const stato = (oreTot > 0 && oreEro >= oreTot)
                      ? { label: 'Completato', bg: '#dcfce7', text: '#166534' }
                      : orePian === 0
                      ? { label: 'Da pianificare', bg: '#f3f4f6', text: '#6b7280' }
                      : { label: 'In corso', bg: '#dbeafe', text: '#1e40af' }

                    return (
                      <div key={corso.id} className="bg-white rounded-xl px-5 py-4" style={{ border: '0.5px solid #e5e5e5' }}>
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
                            {corso.formatore && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <Avatar nome={corso.formatore.nome} id={corso.formatore.id} initials={corso.formatore.avatar_initials} size="sm" />
                                <span className="text-xs text-gray-400">Formatore: {corso.formatore.nome}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{oreTot}h totali</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openModal(corso)}
                            >
                              Note
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
                        <OreCounter
                          oreTotali={oreTot}
                          orePianificate={orePian}
                          oreErogate={oreErogatePerCorso[corso.id] ?? 0}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Note Modal */}
      <Modal
        open={!!selectedCorso}
        onClose={() => { setSelectedCorso(null); setNote([]); setNewNota('') }}
        title={selectedCorso ? `Note — ${selectedCorso.title}` : ''}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNota}
              onChange={e => setNewNota(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNota() } }}
              placeholder="Scrivi una nota..."
              className="flex-1 text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors"
            />
            <Button size="sm" onClick={handleAddNota} loading={savingNota} disabled={!newNota.trim()}>
              Aggiungi
            </Button>
          </div>
          {loadingNote ? (
            <div className="text-center py-6 text-sm text-gray-400">Caricamento...</div>
          ) : note.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">Nessuna nota ancora.</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {note.map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-[7px]">
                  {n.autore && (
                    <Avatar nome={n.autore.nome} id={n.autore.id} initials={n.autore.avatar_initials} size="sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{n.autore?.nome}</span>
                      <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 break-words">{n.testo}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteNota(n.id)}
                    disabled={deletingNota === n.id}
                    className="text-xs text-red-400 hover:text-red-600 shrink-0 disabled:opacity-50"
                  >
                    {deletingNota === n.id ? '...' : 'Elimina'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
