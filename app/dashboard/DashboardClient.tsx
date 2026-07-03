'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ProgettoConStats } from '@/lib/types'
import { StatCard } from '@/components/ui/StatCard'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'

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

export type DashCorso = {
  id: string
  project_id: string
  finanziamento_id: string | null
  formatore_id: string | null
  ore_totali: number
  ore_tutoraggio: number | null
  tutor_previsto: boolean
  calendario_inviato_at: string | null
  calendario_confermato: boolean | null
  stato_assegnazione: string | null
  accettazione_risposta_at: string | null
}

interface DashboardClientProps {
  progetti: ProgettoConStats[]
  corsi: DashCorso[]
  finanziamenti: { id: string; nome: string }[]
  oreCompletatePerCorso: Record<string, number>
  orePianificatePerCorso: Record<string, number>
  oreErogatePerProgetto: Record<string, number>
  thisMonthStart: string
}

export function DashboardClient({
  progetti,
  corsi,
  finanziamenti,
  oreCompletatePerCorso,
  orePianificatePerCorso,
  oreErogatePerProgetto,
  thisMonthStart,
}: DashboardClientProps) {
  const [filterFinId, setFilterFinId] = useState('')

  const finMap = useMemo(() => new Map(finanziamenti.map(f => [f.id, f.nome])), [finanziamenti])

  const filteredProjects = useMemo(() =>
    filterFinId ? progetti.filter(p => p.finanziamento_id === filterFinId) : progetti
  , [progetti, filterFinId])

  const filteredProjectIds = useMemo(() => new Set(filteredProjects.map(p => p.id)), [filteredProjects])

  const filteredCorsi = useMemo(() =>
    corsi.filter(c => filteredProjectIds.has(c.project_id))
  , [corsi, filteredProjectIds])

  const nProgetti = filteredProjects.length
  const nCorsi = filteredCorsi.length
  const oreTotali = filteredProjects.reduce((s, p) => s + Number(p.ore_totali), 0)
  const orePianificate = filteredProjects.reduce((s, p) => s + Number(p.ore_pianificate), 0)
  const pctGlobale = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0
  const oreTutoraggioTotali = filteredProjects.reduce((s, p) => s + Number(p.ore_tutoraggio_totali || 0), 0)
  const oreTutor_aggioPianificate = filteredProjects.reduce((s, p) => s + Number(p.ore_tutoraggio_pianificate || 0), 0)

  const oreErogate = filteredCorsi.reduce((s, c) => s + (oreCompletatePerCorso[c.id] ?? 0), 0)

  const corsiConTutor = filteredCorsi.filter(c => c.tutor_previsto && c.ore_tutoraggio)
  const oreTutorErogate = corsiConTutor.reduce((sum, c) => {
    const oreComp = oreCompletatePerCorso[c.id] ?? 0
    if (!c.ore_tutoraggio || !c.ore_totali || Number(c.ore_totali) === 0) return sum
    return sum + Math.round(Number(c.ore_tutoraggio) * (oreComp / Number(c.ore_totali)))
  }, 0)

  const corsiAssegnati = filteredCorsi.filter(c => c.formatore_id !== null)
  const nCorsiAssegnati = corsiAssegnati.length
  const oreTotaliAssegnate = corsiAssegnati.reduce((s, c) => s + c.ore_totali, 0)
  const orePianificateAssegnate = corsiAssegnati.reduce((s, c) => s + (orePianificatePerCorso[c.id] ?? 0), 0)
  const oreErogateAssegnate = corsiAssegnati.reduce((s, c) => s + (oreCompletatePerCorso[c.id] ?? 0), 0)

  const corsiDaPianificare = filteredCorsi.filter(c => {
    const orePian = orePianificatePerCorso[c.id] ?? 0
    return c.formatore_id && orePian < c.ore_totali
  }).length

  const corsiDaInviare = filteredCorsi.filter(c => {
    const orePian = orePianificatePerCorso[c.id] ?? 0
    return orePian >= c.ore_totali && !c.calendario_inviato_at
  }).length

  const corsiInAttesaConferma = filteredCorsi.filter(c =>
    c.calendario_inviato_at && !c.calendario_confermato
  ).length

  const corsiCalendarioConfermati = filteredCorsi.filter(c => c.calendario_confermato).length

  const corsiInAttesa = filteredCorsi.filter(c => c.stato_assegnazione === 'in_attesa').length

  const corsiRifiutatiMese = filteredCorsi.filter(c =>
    c.stato_assegnazione === 'rifiutato' &&
    c.accettazione_risposta_at != null &&
    c.accettazione_risposta_at >= thisMonthStart
  ).length

  const oreErogatePerProgettoFiltered = useMemo(() => {
    const result: Record<string, number> = {}
    for (const c of filteredCorsi) {
      const ore = oreCompletatePerCorso[c.id] ?? 0
      if (ore > 0) result[c.project_id] = (result[c.project_id] ?? 0) + ore
    }
    return result
  }, [filteredCorsi, oreCompletatePerCorso])

  const selectCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Panoramica di tutti i progetti formativi</p>
        </div>
        {finanziamenti.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Linea di finanziamento:</span>
            <select value={filterFinId} onChange={e => setFilterFinId(e.target.value)} className={selectCls}>
              <option value="">Tutti</option>
              {finanziamenti.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Stat cards — riga 1 */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <StatCard
          label="Progetti attivi"
          value={nProgetti}
          subtitle={`${filteredProjects.filter(p => p.status === 'active').length} in corso`}
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/></svg>}
        />
        <StatCard
          label="Corsi totali"
          value={nCorsi}
          subtitle="in tutti i progetti"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 17l9 4.5 9-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <StatCard
          label="Ore formazione totali"
          value={`${oreTotali}h`}
          subtitle={`${orePianificate}h pianificate`}
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <StatCard
          label="Ore erogate"
          value={`${oreErogate}h`}
          subtitle="sessioni confermate"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <StatCard
          label="Completamento globale"
          value={`${pctGlobale}%`}
          subtitle="calendari pianificati"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>

      {/* Corsi assegnati */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl p-5 flex flex-col gap-3" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-start justify-between">
            <span className="text-sm text-gray-500 font-medium">Corsi assegnati</span>
            <span className="text-gray-400">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 20a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <polyline points="17 11 19 13 23 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">{nCorsiAssegnati}</div>
            <div className="text-sm text-gray-400 mt-0.5">su {nCorsi} corsi totali</div>
          </div>
          {oreTotaliAssegnate > 0 ? (
            <>
              <DualProgressBar
                oreTotali={oreTotaliAssegnate}
                orePianificate={orePianificateAssegnate}
                oreErogate={oreErogateAssegnate}
              />
              <div className="text-xs text-gray-400">
                {orePianificateAssegnate}h pianificate su {oreTotaliAssegnate}h totali assegnate
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-400">Nessun corso con ore assegnate</div>
          )}
        </div>
      </div>

      {/* Tutoraggio */}
      {oreTutoraggioTotali > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Ore tutoraggio totali"
            value={`${oreTutoraggioTotali}h`}
            subtitle="corsi con tutor previsto"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 20a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M19 13v6M16 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
          <StatCard
            label="Ore tutoraggio pianificate"
            value={`${oreTutor_aggioPianificate}h`}
            subtitle="proporzionale al completamento"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          />
          <StatCard
            label="Ore tutor erogate"
            value={`${oreTutorErogate}h`}
            subtitle="proporzionale alle sessioni completate"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 20a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><polyline points="16 13 18 15 22 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>
      )}
      {oreTutoraggioTotali === 0 && <div className="mb-4" />}

      {/* Accettazione */}
      {(corsiInAttesa > 0 || corsiRifiutatiMese > 0) && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {corsiInAttesa > 0 && (
            <Link href="/progetti?in_attesa=1" className="block hover:opacity-90 transition-opacity">
              <StatCard
                label="In attesa di accettazione"
                value={corsiInAttesa}
                subtitle="clicca per vedere i progetti →"
                icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/></svg>}
              />
            </Link>
          )}
          {corsiRifiutatiMese > 0 && (
            <StatCard
              label="Rifiutati questo mese"
              value={corsiRifiutatiMese}
              subtitle="da riassegnare"
              icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
            />
          )}
        </div>
      )}
      {corsiInAttesa === 0 && corsiRifiutatiMese === 0 && <div className="mb-4" />}

      {/* Calendario */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Da pianificare"
          value={corsiDaPianificare}
          subtitle="formatore assegnato, calendario incompleto"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <StatCard
          label="Da inviare"
          value={corsiDaInviare}
          subtitle="calendario completo, non inviato"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <StatCard
          label="In attesa conferma"
          value={corsiInAttesaConferma}
          subtitle="inviato, attesa risposta scuola"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <StatCard
          label="Confermati"
          value={corsiCalendarioConfermati}
          subtitle="calendario approvato dalla scuola"
          icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>

      {/* Tabella progetti */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {filterFinId ? `Progetti — ${finanziamenti.find(f => f.id === filterFinId)?.nome}` : 'Tutti i progetti'}
          </h2>
          <Link href="/progetti" className="text-sm font-medium hover:underline" style={{ color: '#d64b55' }}>
            Vedi tutti →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">SCUOLA</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">ANNO</th>
                <th className="text-center text-xs font-medium text-gray-400 px-6 py-3">CORSI</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3 min-w-[180px]">PIANIFICAZIONE</th>
                <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">STATO</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProjects.slice(0, 8).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-gray-900">{p.school_name}</div>
                    <div className="text-xs text-gray-400">{p.address}</div>
                    {p.finanziamento_id && finMap.has(p.finanziamento_id) && (() => {
                      const nome = finMap.get(p.finanziamento_id!)!
                      const c = badgeColor(nome)
                      return (
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-md mt-1"
                          style={{ backgroundColor: c.bg, color: c.text }}>
                          {nome}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.anno_scolastico}</td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">{p.n_corsi}</td>
                  <td className="px-6 py-4">
                    <DualProgressBar
                      oreTotali={Number(p.ore_totali)}
                      orePianificate={Number(p.ore_pianificate)}
                      oreErogate={oreErogatePerProgettoFiltered[p.id] ?? 0}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge variant={p.status} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/progetti/${p.id}`} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                      Dettagli →
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    Nessun progetto trovato.{' '}
                    <Link href="/progetti" className="underline" style={{ color: '#d64b55' }}>
                      Crea il primo progetto
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
