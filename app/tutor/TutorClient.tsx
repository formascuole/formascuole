'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CorsoConOre, NotaCorso, Profile } from '@/lib/types'
import { OreCounter } from '@/components/ui/OreCounter'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

interface CorsoConProgetto extends CorsoConOre {
  progetti?: { school_name: string; anno_scolastico: string; ref_name: string; ref_email: string }
  formatore?: Profile
}

interface TutorClientProps {
  corsi: CorsoConProgetto[]
  profile: Profile
}

export function TutorClient({ corsi, profile }: TutorClientProps) {
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

  const openModal = async (corso: CorsoConProgetto) => {
    setSelectedCorso(corso)
    setLoadingNote(true)
    try {
      const res = await fetch(`/api/note?corso_id=${corso.id}`)
      if (res.ok) {
        const data = await res.json()
        setNote(data || [])
      }
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">I miei corsi</h1>
        <p className="text-sm text-gray-500 mt-1">Visualizza i corsi di tutoraggio assegnati</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Corsi assegnati"
          value={corsi.length}
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        />
        <StatCard
          label="Ore totali"
          value={`${totalPianificate}/${totalOre}h`}
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          }
        />
        <StatCard
          label="Avanzamento globale"
          value={`${pctGlobale}%`}
          icon={
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        />
      </div>

      {/* Corsi list */}
      {corsi.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="text-3xl mb-3">📋</div>
          <h3 className="font-semibold text-gray-700 mb-1">Nessun corso assegnato</h3>
          <p className="text-sm text-gray-400">Contatta l&apos;amministratore per l&apos;assegnazione</p>
        </div>
      ) : (
        <div className="space-y-3">
          {corsi.map((corso) => {
            const orePianificate = Number(corso.ore_pianificate)
            const oreTotali = Number(corso.ore_totali)
            const pct = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0
            return (
              <div
                key={corso.id}
                className="bg-white rounded-xl p-5 cursor-pointer hover:shadow-sm transition-shadow"
                style={{ border: '0.5px solid #e5e5e5' }}
                onClick={() => openModal(corso)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{corso.title}</h3>
                    <StatusBadge variant={corso.tipo} />
                    {corso.calendario_completo && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-md font-medium">
                        ✓ Completo
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openModal(corso) }}>
                    Note
                  </Button>
                </div>

                {corso.progetti && (
                  <div className="text-xs text-gray-400 mb-3">
                    {corso.progetti.school_name} · {corso.progetti.anno_scolastico}
                  </div>
                )}

                {corso.formatore && (
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar
                      nome={corso.formatore.nome}
                      id={corso.formatore.id}
                      initials={corso.formatore.avatar_initials}
                      size="sm"
                    />
                    <span className="text-xs text-gray-500">Formatore: {corso.formatore.nome}</span>
                  </div>
                )}

                <OreCounter oreTotali={oreTotali} orePianificate={orePianificate} />
                <div className="mt-2">
                  <ProgressBar value={pct} />
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
          {/* Add note */}
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

          {/* Note list */}
          {loadingNote ? (
            <div className="text-center py-6 text-sm text-gray-400">Caricamento...</div>
          ) : note.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">Nessuna nota ancora.</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {note.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-[7px]"
                >
                  {n.autore && (
                    <Avatar
                      nome={n.autore.nome}
                      id={n.autore.id}
                      initials={n.autore.avatar_initials}
                      size="sm"
                    />
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
