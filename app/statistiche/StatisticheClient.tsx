'use client'
import { useRef } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { StatisticheData } from './page'

interface Props { data: StatisticheData }

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl ${className}`} style={{ border: '0.5px solid #e5e5e5' }}>
      {children}
    </div>
  )
}

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e5e5' }}>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#ef4444' : '#e5e7eb'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-8 text-right">{pct}%</span>
    </div>
  )
}

function TassoCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300 text-sm">—</span>
  const color = value >= 80 ? 'text-green-700 bg-green-50' : value >= 50 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md ${color}`}>
      {value}%
    </span>
  )
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(data: StatisticheData) {
  const rows: string[][] = []

  rows.push(['RIEPILOGO GENERALE'])
  rows.push(['Metrica', 'Valore'])
  rows.push(['Progetti attivi', String(data.nProgettiAttivi)])
  rows.push(['Progetti in attesa', String(data.nProgettiPending)])
  rows.push(['Progetti completati', String(data.nProgettiCompletati)])
  rows.push(['Corsi PF', String(data.nCorsiPF)])
  rows.push(['Corsi Lab', String(data.nCorsiLab)])
  rows.push(['Ore totali assegnate', String(data.oreTotali)])
  rows.push(['Ore pianificate', String(data.orePianificate)])
  rows.push(['Ore erogate (completate)', String(data.oreCompletate)])
  rows.push(['% completamento globale', String(data.pctCompletamento) + '%'])
  rows.push(['Formatori attivi', String(data.nFormatori)])
  rows.push(['Corsi in attesa accettazione', String(data.corsiInAttesa)])
  rows.push(['Corsi rifiutati questo mese', String(data.corsiRifiutatiMese)])
  rows.push([])

  rows.push(['STATISTICHE PER FINANZIAMENTO'])
  rows.push(['Finanziamento', 'N. Progetti', 'N. Corsi', 'Ore totali', 'Ore pianificate', '% completamento'])
  for (const f of data.perFinanziamento) {
    rows.push([f.nome, String(f.nProgetti), String(f.nCorsi), String(f.oreTotali), String(f.orePianificate), String(f.pct) + '%'])
  }
  rows.push([])

  rows.push(['STATISTICHE PER FORMATORE'])
  rows.push(['Formatore', 'N. Corsi', 'Ore totali', '% completamento', 'Tasso accettazione', 'N. rifiuti'])
  for (const f of data.perFormatore) {
    rows.push([
      f.nome, String(f.nCorsi), String(f.oreTotali), String(f.pct) + '%',
      f.tassoAccettazione !== null ? String(f.tassoAccettazione) + '%' : '—',
      String(f.nRifiuti),
    ])
  }
  rows.push([])

  rows.push(['ANDAMENTO MENSILE'])
  rows.push(['Mese', 'Sessioni completate', 'Ore erogate'])
  for (const m of data.andamentoMensile) {
    rows.push([m.mese, String(m.sessioni), String(m.ore)])
  }

  const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date().toISOString().split('T')[0]
  a.download = `statistiche-formascuole-${now}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function FinTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  const labels: Record<string, string> = { oreTotali: 'Ore totali', orePianificate: 'Ore pianificate' }
  return (
    <div className="bg-white rounded-lg px-3 py-2 text-xs shadow-md" style={{ border: '0.5px solid #e5e5e5' }}>
      {payload.map(p => (
        <div key={p.name}><span className="text-gray-500">{labels[p.name] ?? p.name}:</span> <strong>{p.value}h</strong></div>
      ))}
    </div>
  )
}

function MensileTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-lg px-3 py-2 text-xs shadow-md" style={{ border: '0.5px solid #e5e5e5' }}>
      <div className="font-medium text-gray-700 mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.name}>
          <span className="text-gray-500">{p.name === 'ore' ? 'Ore erogate' : 'Sessioni'}:</span>{' '}
          <strong>{p.name === 'ore' ? `${p.value}h` : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function StatisticheClient({ data }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => window.print()

  return (
    <div ref={printRef} className="p-8 max-w-6xl mx-auto print:p-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiche</h1>
          <p className="text-sm text-gray-500 mt-1">Report aggregato di tutti i dati della piattaforma</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link
            href="/statistiche/questionari"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Valutazioni questionari
          </Link>
          <button
            onClick={() => exportCSV(data)}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Esporta Excel
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-[7px] text-white transition-colors"
            style={{ backgroundColor: '#d64b55' }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
              <polyline points="6 9 6 2 18 2 18 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Esporta PDF
          </button>
        </div>
      </div>

      {/* ── Sezione 1: Riepilogo generale ──────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader title="Riepilogo generale" />

        {/* Progetti */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <StatTile label="Progetti attivi" value={data.nProgettiAttivi} accent="text-blue-700" />
          <StatTile label="In attesa" value={data.nProgettiPending} accent="text-amber-600" />
          <StatTile label="Completati" value={data.nProgettiCompletati} accent="text-green-700" />
        </div>

        {/* Corsi */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatTile label="Corsi PF" value={data.nCorsiPF} sub="Percorsi formativi" />
          <StatTile label="Corsi Lab" value={data.nCorsiLab} sub="Laboratori" />
        </div>

        {/* Ore */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <StatTile label="Ore assegnate" value={`${data.oreTotali}h`} />
          <StatTile label="Ore pianificate" value={`${data.orePianificate}h`} sub={`${data.pctCompletamento}% del totale`} />
          <StatTile label="Ore erogate" value={`${data.oreCompletate}h`} sub="sessioni confermate" accent="text-green-700" />
          <StatTile label="Completamento" value={`${data.pctCompletamento}%`} sub="pianificazione globale" />
        </div>

        {/* Formatori + Accettazione */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Formatori attivi" value={data.nFormatori} sub="con almeno 1 corso" />
          {data.corsiInAttesa > 0 && (
            <StatTile
              label="In attesa accettazione"
              value={data.corsiInAttesa}
              sub="da accettare"
              accent="text-amber-600"
            />
          )}
          {data.corsiRifiutatiMese > 0 && (
            <StatTile
              label="Rifiutati questo mese"
              value={data.corsiRifiutatiMese}
              sub="da riassegnare"
              accent="text-red-600"
            />
          )}
        </div>
      </section>

      {/* ── Sezione 2: Per finanziamento ───────────────────────────────────── */}
      {data.perFinanziamento.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            title="Per tipo di finanziamento"
            subtitle="Distribuzione di progetti, corsi e ore per fonte di finanziamento"
          />
          <Card>
            {/* Bar chart */}
            <div className="px-6 pt-6 pb-2 print:hidden">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.perFinanziamento} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip content={<FinTooltip />} />
                  <Legend formatter={(v) => v === 'oreTotali' ? 'Ore totali' : 'Ore pianificate'} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="oreTotali" fill="#dbeafe" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="orePianificate" fill="#d64b55" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Table */}
            <table className="w-full">
              <thead>
                <tr className="border-t border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">FINANZIAMENTO</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">PROGETTI</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">CORSI</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE TOTALI</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 min-w-[160px]">COMPLETAMENTO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.perFinanziamento.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{f.nProgetti}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{f.nCorsi}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{f.oreTotali}h</td>
                    <td className="px-4 py-3">
                      <MiniBar value={f.orePianificate} max={f.oreTotali} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* ── Sezione 3: Per formatore ────────────────────────────────────────── */}
      {data.perFormatore.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            title="Per formatore"
            subtitle={`${data.perFormatore.length} formatori con corsi assegnati`}
          />
          <Card>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">FORMATORE</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">CORSI</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 min-w-[140px]">COMPLETAMENTO</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ACCETTAZIONE</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">RIFIUTI</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.perFormatore.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{f.nCorsi}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{f.oreTotali}h</td>
                    <td className="px-4 py-3">
                      <MiniBar value={f.pct} max={100} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TassoCell value={f.tassoAccettazione} />
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {f.nRifiuti > 0
                        ? <span className="font-medium text-red-600">{f.nRifiuti}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/utenti/${f.id}`}
                        className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        Dettagli →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* ── Sezione 4: Andamento mensile ────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader
          title="Andamento mensile"
          subtitle="Sessioni completate e ore erogate negli ultimi 12 mesi"
        />
        <Card className="p-6">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.andamentoMensile} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="mese" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<MensileTooltip />} />
              <Legend
                formatter={(v) => v === 'sessioni' ? 'Sessioni completate' : 'Ore erogate'}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar yAxisId="left" dataKey="sessioni" fill="#d64b55" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar yAxisId="right" dataKey="ore" fill="#dbeafe" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {data.andamentoMensile.reduce((s, m) => s + m.sessioni, 0)}
              </div>
              <div className="text-xs text-gray-400">sessioni negli ultimi 12 mesi</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {data.andamentoMensile.reduce((s, m) => s + m.ore, 0)}h
              </div>
              <div className="text-xs text-gray-400">ore erogate negli ultimi 12 mesi</div>
            </div>
          </div>
        </Card>
      </section>

      {/* Print footer */}
      <div className="hidden print:block text-xs text-gray-400 border-t border-gray-100 pt-4 mt-8">
        Report generato il {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} — Formascuole
      </div>
    </div>
  )
}
