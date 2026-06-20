'use client'
import { useState, useMemo } from 'react'
import { StatisticheNav } from '@/components/ui/StatisticheNav'
import { DualProgressBar } from '@/components/ui/DualProgressBar'
import { ModalitaIcon } from '@/components/ui/ModalitaIcon'
import type { CorsoStatRow } from './page'

interface Props {
  corsi: CorsoStatRow[]
  formatori: { id: string; nome: string }[]
  scuole: string[]
  finanziamenti: { id: string; nome: string }[]
}

const STATO_LABELS: Record<CorsoStatRow['stato'], string> = {
  da_pianificare: 'Da pianificare',
  in_corso: 'In corso',
  completato: 'Completato',
  confermato: 'Cal. confermato',
}

const STATO_BADGE: Record<CorsoStatRow['stato'], string> = {
  da_pianificare: 'bg-gray-100 text-gray-500',
  in_corso: 'bg-amber-100 text-amber-700',
  completato: 'bg-green-100 text-green-700',
  confermato: 'bg-blue-100 text-blue-700',
}

function formatDateShort(d: string | null): string | null {
  if (!d) return null
  const [y, m, day] = d.substring(0, 10).split('-')
  return `${day}/${m}/${y.slice(2)}`
}

async function exportCorsi(rows: CorsoStatRow[], filters: string) {
  const XLSX = await import('xlsx')
  const headers = [
    'Scuola', 'Titolo', 'Tipo', 'Formatore', 'Ore tot.', 'Ore pian.',
    'Ore erog.', '%', 'Stato', 'Prima sessione', 'Ultima sessione', 'Finanziamento',
  ]
  const data = rows.map(c => [
    c.school_name,
    c.title,
    c.tipo,
    c.formatore_nome || '',
    c.ore_totali,
    c.ore_pianificate,
    c.ore_erogate,
    c.pct > 0 ? `${c.pct}%` : '',
    STATO_LABELS[c.stato],
    c.prima_sessione ? new Date(c.prima_sessione).toLocaleDateString('it-IT') : '',
    c.ultima_sessione ? new Date(c.ultima_sessione).toLocaleDateString('it-IT') : '',
    c.linea_finanziamento || '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...data.map(r => String(r[i] ?? '').length)) + 2, 40),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Corsi')
  const today = new Date().toISOString().split('T')[0]
  const suffix = filters ? `_${filters}` : ''
  XLSX.writeFile(wb, `Corsi_Formascuole${suffix}_${today}.xlsx`)
}

export function CorsiStatisticsClient({ corsi, formatori, scuole, finanziamenti }: Props) {
  const [filterStato, setFilterStato] = useState<'' | CorsoStatRow['stato']>('')
  const [filterFormatore, setFilterFormatore] = useState('')
  const [filterScuola, setFilterScuola] = useState('')
  const [filterFinanziamento, setFilterFinanziamento] = useState('')
  const [filterAnno, setFilterAnno] = useState('')

  const anni = useMemo(() => {
    const s = new Set<string>()
    for (const c of corsi) {
      const a = c.prima_sessione?.substring(0, 4) || ''
      if (a) s.add(a)
    }
    return [...s].sort().reverse()
  }, [corsi])

  const filtered = useMemo(() => corsi.filter(c => {
    if (filterStato && c.stato !== filterStato) return false
    if (filterFormatore && c.formatore_id !== filterFormatore) return false
    if (filterScuola && c.school_name !== filterScuola) return false
    if (filterFinanziamento && c.linea_finanziamento !== filterFinanziamento) return false
    if (filterAnno) {
      const anno = (c.prima_sessione || '').substring(0, 4) || ''
      if (anno !== filterAnno) return false
    }
    return true
  }), [corsi, filterStato, filterFormatore, filterScuola, filterFinanziamento, filterAnno])

  const hasFilters = !!(filterStato || filterFormatore || filterScuola || filterFinanziamento || filterAnno)

  function buildFilterSuffix() {
    const parts: string[] = []
    if (filterFormatore) {
      const f = formatori.find(x => x.id === filterFormatore)
      if (f) parts.push(f.nome.replace(/\s+/g, '_').slice(0, 20))
    }
    if (filterScuola) parts.push(filterScuola.replace(/\s+/g, '_').slice(0, 20))
    return parts.join('_')
  }

  function reset() {
    setFilterStato('')
    setFilterFormatore('')
    setFilterScuola('')
    setFilterFinanziamento('')
    setFilterAnno('')
  }

  const selectCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiche corsi</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} cors{filtered.length === 1 ? 'o' : 'i'}
            {hasFilters && <span className="ml-1 text-[#d64b55]">(filtrati)</span>}
          </p>
        </div>
        <button
          onClick={() => exportCorsi(filtered, buildFilterSuffix())}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Esporta Excel
        </button>
      </div>

      <StatisticheNav />

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end" style={{ border: '0.5px solid #e5e5e5' }}>
        <div>
          <div className="text-xs text-gray-400 mb-1">Stato</div>
          <select value={filterStato} onChange={e => setFilterStato(e.target.value as '' | CorsoStatRow['stato'])} className={selectCls}>
            <option value="">Tutti</option>
            <option value="da_pianificare">Da pianificare</option>
            <option value="in_corso">In corso</option>
            <option value="completato">Completato</option>
            <option value="confermato">Cal. confermato</option>
          </select>
        </div>
        {formatori.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Formatore</div>
            <select value={filterFormatore} onChange={e => setFilterFormatore(e.target.value)} className={selectCls}>
              <option value="">Tutti</option>
              {formatori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}
        {scuole.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Scuola</div>
            <select value={filterScuola} onChange={e => setFilterScuola(e.target.value)} className={`${selectCls} max-w-[220px]`}>
              <option value="">Tutte</option>
              {scuole.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {finanziamenti.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Finanziamento</div>
            <select value={filterFinanziamento} onChange={e => setFilterFinanziamento(e.target.value)} className={`${selectCls} max-w-[200px]`}>
              <option value="">Tutti</option>
              {finanziamenti.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
            </select>
          </div>
        )}
        {anni.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Anno</div>
            <select value={filterAnno} onChange={e => setFilterAnno(e.target.value)} className={selectCls}>
              <option value="">Tutti</option>
              {anni.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
        {hasFilters && (
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5">
            Azzera filtri
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
          Nessun corso con i filtri selezionati.
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">SCUOLA</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">TITOLO CORSO</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">TIPO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">FORMATORE</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE TOT.</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE PIAN.</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE EROG.</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 min-w-[100px]">%</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">STATO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">PERIODO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">FINANZIAMENTO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => {
                const p1 = formatDateShort(c.prima_sessione)
                const p2 = formatDateShort(c.ultima_sessione)
                const periodo = p1 ? (p2 && p2 !== p1 ? `${p1} – ${p2}` : p1) : '—'
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[180px] truncate">{c.school_name}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <ModalitaIcon modalita={c.modalita} tipo={c.tipo} size={14} />
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${c.tipo === 'PF' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {c.tipo}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.formatore_nome || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{c.ore_totali}h</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{c.ore_pianificate}h</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-blue-700">{c.ore_erogate}h</td>
                    <td className="px-4 py-3 min-w-[100px]">
                      <DualProgressBar oreTotali={c.ore_totali} orePianificate={c.ore_pianificate} oreErogate={c.ore_erogate} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${STATO_BADGE[c.stato]}`}>
                        {STATO_LABELS[c.stato]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{periodo}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.linea_finanziamento || <span className="text-gray-300">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
