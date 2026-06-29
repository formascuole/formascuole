'use client'
import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import type { CorsoECItem } from './page'
import { REGIME_LABELS, REGIME_BADGE, fmtCur, type RegimeFiscale } from '@/lib/economia-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgettoRow {
  progetto_id: string
  school_name: string
  finanziamento_nome: string | null
  n_formatori: number
  n_corsi: number
  ore_totali: number
  fatturato_scuola: number
  costo_formatori: number
  costo_tutor: number
  margine: number
}

interface FormatoreRow {
  formatore_id: string
  formatore_nome: string
  regime_fiscale: RegimeFiscale
  n_corsi: number
  ore_totali: number
  netto: number
  netto_tutor: number
  margine: number
}

interface FormatorGlobalRow {
  formatore_id: string
  formatore_nome: string
  regime_fiscale: RegimeFiscale
  n_corsi: number
  ore_totali: number
  imponibile: number
  ritenuta: number
  iva: number
  inps: number
  netto: number
  ritenuteIva: number
  netto_tutor: number
  totale_fattura_scuola: number
  margine: number
}

interface Props {
  items: CorsoECItem[]
  formatori: { id: string; nome: string }[]
  progetti: { id: string; nome: string }[]
  finanziamenti: { id: string; nome: string }[]
}

type FilterAnno = string

// ─── Excel export ─────────────────────────────────────────────────────────────

const REGIME_EXPORT: Record<RegimeFiscale, string> = {
  forfettario: 'Forfettario',
  ordinario: 'Ordinario',
  notula: 'Prestazione occasionale',
}

async function exportEstrattiConto(
  filtered: CorsoECItem[],
  progettiRows: ProgettoRow[],
  formatoriGlobalRows: FormatorGlobalRow[],
  filterLabel: string,
) {
  const XLSX = await import('xlsx')
  const dateStr = new Date().toISOString().substring(0, 10)
  const filename = `EstrattoConto${filterLabel ? '_' + filterLabel : ''}_${dateStr}.xlsx`

  // Foglio 1: Dettaglio per corso
  const s1Headers = [
    'Corso', 'Scuola', 'Anno', 'Finanziamento',
    'Formatore', 'Regime', 'Ore Erogate', 'Tariffa Form./h',
    'Imponibile Form. (€)', 'Ritenuta (€)', 'IVA (€)', 'INPS (€)', 'Netto Formatore (€)',
    'Tutor', 'Ore Tutor', 'Tariffa Tutor/h',
    'Imponibile Tutor (€)', 'Ritenuta Tutor (€)', 'IVA Tutor (€)', 'INPS Tutor (€)', 'Netto Tutor (€)',
    'Tariffa Scuola Form./h', 'Importo Scuola Form. (€)',
    'Tariffa Scuola Tutor/h', 'Importo Scuola Tutor (€)',
    'Totale Fatturato Scuola (€)', 'Margine (€)',
  ]
  const s1Data = filtered.map(i => [
    i.title, i.school_name, i.anno ?? '', i.finanziamento_nome ?? '',
    i.formatore_nome, REGIME_EXPORT[i.regime_fiscale], i.ore_erogate, i.tariffa ?? '',
    i.imponibile, i.ritenuta, i.iva, i.inps, i.netto,
    i.tutor_nome ?? '', i.ore_tutoraggio || '', i.tariffa_tutor ?? '',
    i.imponibile_tutor, i.ritenuta_tutor, i.iva_tutor, i.inps_tutor, i.netto_tutor,
    i.tariffa_scuola_formatore ?? '', i.importo_scuola_formatore,
    i.tariffa_scuola_tutor ?? '', i.importo_scuola_tutor,
    i.totale_fattura_scuola, i.margine,
  ])
  const ws1 = XLSX.utils.aoa_to_sheet([s1Headers, ...s1Data])
  ws1['!cols'] = s1Headers.map(h => ({ wch: Math.max(h.length + 2, 14) }))

  // Foglio 2: Riepilogo per progetto
  const s2Headers = [
    'Progetto (Scuola)', 'Finanziamento', 'N. Formatori', 'N. Corsi', 'Ore Totali',
    'Fatturato Scuola (€)', 'Costo Formatori (€)', 'Costo Tutor (€)', 'Margine (€)',
  ]
  const s2Data: (string | number)[][] = progettiRows.map(p => [
    p.school_name, p.finanziamento_nome ?? '', p.n_formatori, p.n_corsi, p.ore_totali,
    p.fatturato_scuola, p.costo_formatori, p.costo_tutor, p.margine,
  ])
  s2Data.push([
    'TOTALE', '',
    progettiRows.reduce((s, p) => s + p.n_formatori, 0),
    progettiRows.reduce((s, p) => s + p.n_corsi, 0),
    progettiRows.reduce((s, p) => s + p.ore_totali, 0),
    progettiRows.reduce((s, p) => s + p.fatturato_scuola, 0),
    progettiRows.reduce((s, p) => s + p.costo_formatori, 0),
    progettiRows.reduce((s, p) => s + p.costo_tutor, 0),
    progettiRows.reduce((s, p) => s + p.margine, 0),
  ])
  const ws2 = XLSX.utils.aoa_to_sheet([s2Headers, ...s2Data])
  ws2['!cols'] = s2Headers.map(h => ({ wch: Math.max(h.length + 2, 16) }))

  // Foglio 3: Riepilogo per formatore
  const s3Headers = [
    'Formatore', 'Regime', 'N. Corsi', 'Ore Erogate',
    'Imponibile (€)', 'Ritenuta (€)', 'IVA (€)', 'INPS (€)',
    'Netto Form. (€)', 'Netto Tutor (€)', 'Fatturato Scuola (€)', 'Margine (€)',
  ]
  const s3Data: (string | number)[][] = formatoriGlobalRows.map(r => [
    r.formatore_nome, REGIME_EXPORT[r.regime_fiscale], r.n_corsi, r.ore_totali,
    r.imponibile, r.ritenuta, r.iva, r.inps, r.netto, r.netto_tutor,
    r.totale_fattura_scuola, r.margine,
  ])
  s3Data.push([
    'TOTALE', '',
    formatoriGlobalRows.reduce((s, r) => s + r.n_corsi, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.ore_totali, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.imponibile, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.ritenuta, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.iva, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.inps, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.netto, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.netto_tutor, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.totale_fattura_scuola, 0),
    formatoriGlobalRows.reduce((s, r) => s + r.margine, 0),
  ])
  const ws3 = XLSX.utils.aoa_to_sheet([s3Headers, ...s3Data])
  ws3['!cols'] = s3Headers.map(h => ({ wch: Math.max(h.length + 2, 14) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Dettaglio per corso')
  XLSX.utils.book_append_sheet(wb, ws2, 'Riepilogo per progetto')
  XLSX.utils.book_append_sheet(wb, ws3, 'Riepilogo per formatore')
  XLSX.writeFile(wb, filename)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSigned(v: number) {
  if (v === 0) return <span className="text-gray-300">—</span>
  const cls = v < 0 ? 'text-red-600' : 'text-green-700'
  const sign = v > 0 ? '+' : ''
  return <span className={`font-mono ${cls}`}>{sign}{fmtCur(v)}</span>
}

function MargineCell({ v }: { v: number }) {
  if (v === 0) return <span className="text-gray-300">—</span>
  if (v > 0) return <span className="font-mono font-semibold text-emerald-700">{fmtCur(v)}</span>
  return <span className="font-mono font-semibold text-red-600">{fmtCur(v)}</span>
}

function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12" height="12" fill="none" viewBox="0 0 24 24"
      className={`transition-transform flex-shrink-0 text-gray-400 ${expanded ? 'rotate-90' : ''}`}
    >
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EstrattiContoClient({ items, formatori, progetti, finanziamenti }: Props) {
  const currentYear = String(new Date().getFullYear())
  const [filterAnno, setFilterAnno] = useState<FilterAnno>(currentYear)
  const [filterFormatore, setFilterFormatore] = useState('')
  const [filterRegime, setFilterRegime] = useState<'' | RegimeFiscale>('')
  const [filterProgetto, setFilterProgetto] = useState('')
  const [filterFinanziamento, setFilterFinanziamento] = useState('')
  const [expandedProgetti, setExpandedProgetti] = useState<Set<string>>(new Set())
  const [expandedFormatori, setExpandedFormatori] = useState<Set<string>>(new Set())

  const anni = useMemo(() => {
    const s = new Set<string>()
    for (const i of items) if (i.anno) s.add(i.anno)
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [items])

  const filtered = useMemo(() => items.filter(i => {
    if (filterAnno && filterAnno !== 'all' && i.anno !== filterAnno) return false
    if (filterFormatore && i.formatore_id !== filterFormatore) return false
    if (filterRegime && i.regime_fiscale !== filterRegime) return false
    if (filterProgetto && i.progetto_id !== filterProgetto) return false
    if (filterFinanziamento && i.finanziamento_id !== filterFinanziamento) return false
    return true
  }), [items, filterAnno, filterFormatore, filterRegime, filterProgetto, filterFinanziamento])

  // Level 1: raggruppa per progetto
  const progettiRows = useMemo((): ProgettoRow[] => {
    const map = new Map<string, ProgettoRow>()
    const formPerProg = new Map<string, Set<string>>()
    for (const i of filtered) {
      const cur = map.get(i.progetto_id) ?? {
        progetto_id: i.progetto_id,
        school_name: i.school_name,
        finanziamento_nome: i.finanziamento_nome,
        n_formatori: 0, n_corsi: 0, ore_totali: 0,
        fatturato_scuola: 0, costo_formatori: 0, costo_tutor: 0, margine: 0,
      }
      cur.n_corsi++
      cur.ore_totali += i.ore_erogate
      cur.fatturato_scuola += i.totale_fattura_scuola
      cur.costo_formatori += i.netto
      cur.costo_tutor += i.netto_tutor
      cur.margine += i.margine
      map.set(i.progetto_id, cur)
      if (!formPerProg.has(i.progetto_id)) formPerProg.set(i.progetto_id, new Set())
      formPerProg.get(i.progetto_id)!.add(i.formatore_id)
    }
    for (const [pid, row] of map) row.n_formatori = formPerProg.get(pid)?.size ?? 0
    return [...map.values()].sort((a, b) => a.school_name.localeCompare(b.school_name))
  }, [filtered])

  // Level 2: raggruppa per formatore dentro ogni progetto
  const getFormatoriForProgetto = (progettoId: string): FormatoreRow[] => {
    const map = new Map<string, FormatoreRow>()
    for (const i of filtered) {
      if (i.progetto_id !== progettoId) continue
      const cur = map.get(i.formatore_id) ?? {
        formatore_id: i.formatore_id,
        formatore_nome: i.formatore_nome,
        regime_fiscale: i.regime_fiscale,
        n_corsi: 0, ore_totali: 0, netto: 0, netto_tutor: 0, margine: 0,
      }
      cur.n_corsi++
      cur.ore_totali += i.ore_erogate
      cur.netto += i.netto
      cur.netto_tutor += i.netto_tutor
      cur.margine += i.margine
      map.set(i.formatore_id, cur)
    }
    return [...map.values()].sort((a, b) => a.formatore_nome.localeCompare(b.formatore_nome))
  }

  // Riepilogo globale per formatore (per Excel Foglio 3)
  const formatoriGlobalRows = useMemo((): FormatorGlobalRow[] => {
    const map = new Map<string, FormatorGlobalRow>()
    for (const i of filtered) {
      const cur = map.get(i.formatore_id) ?? {
        formatore_id: i.formatore_id, formatore_nome: i.formatore_nome,
        regime_fiscale: i.regime_fiscale,
        n_corsi: 0, ore_totali: 0, imponibile: 0, ritenuta: 0, iva: 0, inps: 0,
        netto: 0, ritenuteIva: 0, netto_tutor: 0, totale_fattura_scuola: 0, margine: 0,
      }
      cur.n_corsi++
      cur.ore_totali += i.ore_erogate
      cur.imponibile += i.imponibile
      cur.ritenuta += i.ritenuta
      cur.iva += i.iva
      cur.inps += i.inps
      cur.netto += i.netto
      cur.ritenuteIva += i.ritenuteIva
      cur.netto_tutor += i.netto_tutor
      cur.totale_fattura_scuola += i.totale_fattura_scuola
      cur.margine += i.margine
      map.set(i.formatore_id, cur)
    }
    return [...map.values()].sort((a, b) => a.formatore_nome.localeCompare(b.formatore_nome))
  }, [filtered])

  const totals = useMemo(() => ({
    n_formatori: new Set(filtered.map(i => i.formatore_id)).size,
    n_corsi: progettiRows.reduce((s, p) => s + p.n_corsi, 0),
    ore_totali: progettiRows.reduce((s, p) => s + p.ore_totali, 0),
    fatturato_scuola: progettiRows.reduce((s, p) => s + p.fatturato_scuola, 0),
    costo_formatori: progettiRows.reduce((s, p) => s + p.costo_formatori, 0),
    costo_tutor: progettiRows.reduce((s, p) => s + p.costo_tutor, 0),
    margine: progettiRows.reduce((s, p) => s + p.margine, 0),
  }), [filtered, progettiRows])

  const toggleProgetto = (id: string) => setExpandedProgetti(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleFormatore = (key: string) => setExpandedFormatori(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const isDefaultFilter = filterAnno === currentYear && !filterFormatore && !filterRegime && !filterProgetto && !filterFinanziamento
  const selCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white'

  function buildFilterLabel() {
    const parts: string[] = []
    if (filterAnno && filterAnno !== 'all') parts.push(filterAnno)
    if (filterFormatore) { const f = formatori.find(x => x.id === filterFormatore); if (f) parts.push(f.nome.split(' ')[0]) }
    if (filterFinanziamento) { const f = finanziamenti.find(x => x.id === filterFinanziamento); if (f) parts.push(f.nome.substring(0, 10)) }
    if (filterProgetto) { const p = progetti.find(x => x.id === filterProgetto); if (p) parts.push(p.nome.substring(0, 10)) }
    return parts.join('_').replace(/\s/g, '-')
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estratti conto formatori</h1>
          <p className="text-sm text-gray-500 mt-1">
            {progettiRows.length} progett{progettiRows.length === 1 ? 'o' : 'i'} — {filtered.length} cors{filtered.length === 1 ? 'o' : 'i'}
          </p>
        </div>
        <button
          onClick={() => exportEstrattiConto(filtered, progettiRows, formatoriGlobalRows, buildFilterLabel())}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Esporta Excel (3 fogli)
        </button>
      </div>

      {/* ── Filtri ── */}
      <div className="bg-white rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end" style={{ border: '0.5px solid #e5e5e5' }}>
        <div>
          <div className="text-xs text-gray-400 mb-1">Anno</div>
          <select value={filterAnno} onChange={e => setFilterAnno(e.target.value)} className={selCls}>
            <option value="all">Tutti</option>
            {anni.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {formatori.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Formatore</div>
            <select value={filterFormatore} onChange={e => setFilterFormatore(e.target.value)} className={selCls}>
              <option value="">Tutti</option>
              {formatori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}
        <div>
          <div className="text-xs text-gray-400 mb-1">Regime</div>
          <select value={filterRegime} onChange={e => setFilterRegime(e.target.value as '' | RegimeFiscale)} className={selCls}>
            <option value="">Tutti</option>
            <option value="notula">Prestazione occ.</option>
            <option value="forfettario">Forfettario</option>
            <option value="ordinario">Ordinario</option>
          </select>
        </div>
        {progetti.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Progetto</div>
            <select value={filterProgetto} onChange={e => setFilterProgetto(e.target.value)} className={selCls}>
              <option value="">Tutti</option>
              {progetti.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        )}
        {finanziamenti.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Finanziamento</div>
            <select value={filterFinanziamento} onChange={e => setFilterFinanziamento(e.target.value)} className={selCls}>
              <option value="">Tutti</option>
              {finanziamenti.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}
        {!isDefaultFilter && (
          <button
            onClick={() => { setFilterAnno(currentYear); setFilterFormatore(''); setFilterRegime(''); setFilterProgetto(''); setFilterFinanziamento('') }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {progettiRows.length === 0 ? (
        <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
          Nessun dato per i filtri selezionati.
        </div>
      ) : (
        <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="overflow-x-auto w-full">
          {/* ── Tabella principale: per progetto ── */}
          <table className="w-full text-[13px] min-w-[580px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5 min-w-[180px]">PROGETTO</th>
                <th className="text-center text-xs font-medium text-gray-400 px-3 py-2.5 hidden md:table-cell">CORSI</th>
                <th className="text-center text-xs font-medium text-gray-400 px-3 py-2.5">ORE</th>
                <th className="text-right text-xs font-medium text-gray-400 px-3 py-2.5 hidden md:table-cell">FAT. SCUOLA</th>
                <th className="text-right text-xs font-medium text-gray-400 px-3 py-2.5">NETTO FORM.</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-2.5">MARGINE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {progettiRows.map(p => {
                const isPExpanded = expandedProgetti.has(p.progetto_id)
                const formatoriRows = getFormatoriForProgetto(p.progetto_id)
                return (
                  <Fragment key={p.progetto_id}>
                    {/* ── PROGETTO ROW ── */}
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleProgetto(p.progetto_id)}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <ExpandChevron expanded={isPExpanded} />
                          <div>
                            <div>{p.school_name}</div>
                            {p.finanziamento_nome && (
                              <div className="text-[11px] font-normal text-gray-400 mt-0.5 leading-tight">{p.finanziamento_nome}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-700 hidden md:table-cell">{p.n_corsi}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{p.ore_totali}h</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700 hidden md:table-cell">
                        {p.fatturato_scuola > 0 ? fmtCur(p.fatturato_scuola) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                        {p.costo_formatori > 0 ? fmtCur(p.costo_formatori) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <MargineCell v={p.margine} />
                      </td>
                    </tr>

                    {/* ── FORMATORI (livello 2) ── */}
                    {isPExpanded && (
                      <tr>
                        <td colSpan={6} className="px-0 py-0 bg-gray-50/40 border-b border-gray-100">
                          <div className="pl-10">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100">
                                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-2 min-w-[140px]">FORMATORE</th>
                                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2 hidden sm:table-cell">REGIME</th>
                                  <th className="text-center text-xs font-medium text-gray-400 px-3 py-2 hidden md:table-cell">CORSI</th>
                                  <th className="text-center text-xs font-medium text-gray-400 px-3 py-2">ORE</th>
                                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-2">NETTO DA PAGARE</th>
                                  <th className="px-3 py-2 hidden sm:table-cell"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {formatoriRows.map(f => {
                                  const fKey = `${p.progetto_id}::${f.formatore_id}`
                                  const isFExpanded = expandedFormatori.has(fKey)
                                  const formatoreCorsi = filtered.filter(
                                    i => i.progetto_id === p.progetto_id && i.formatore_id === f.formatore_id
                                  )
                                  return (
                                    <Fragment key={fKey}>
                                      {/* ── FORMATORE ROW ── */}
                                      <tr
                                        className="hover:bg-white/70 cursor-pointer"
                                        onClick={() => toggleFormatore(fKey)}
                                      >
                                        <td className="px-4 py-2 font-medium text-gray-800">
                                          <div className="flex items-center gap-2">
                                            <button
                                              className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 shrink-0 text-xs font-bold leading-none"
                                              title={isFExpanded ? 'Comprimi dettaglio' : 'Espandi dettaglio economico'}
                                              tabIndex={-1}
                                            >
                                              {isFExpanded ? '−' : '+'}
                                            </button>
                                            {f.formatore_nome}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 hidden sm:table-cell">
                                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${REGIME_BADGE[f.regime_fiscale]}`}>
                                            {REGIME_LABELS[f.regime_fiscale]}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-700 hidden md:table-cell">{f.n_corsi}</td>
                                        <td className="px-3 py-2 text-center text-gray-700">{f.ore_totali}h</td>
                                        <td className="px-4 py-2 text-right">
                                          <span className="font-mono font-semibold text-orange-700">
                                            {f.netto > 0 ? fmtCur(f.netto) : <span className="text-gray-300">—</span>}
                                          </span>
                                          {f.netto_tutor > 0 && (
                                            <span className="ml-1.5 font-mono text-xs text-purple-600">
                                              +{fmtCur(f.netto_tutor)} T.
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                                          <Link
                                            href={`/utenti/${f.formatore_id}`}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-[#d64b55] hover:underline"
                                          >
                                            Profilo
                                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24">
                                              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                          </Link>
                                        </td>
                                      </tr>

                                      {/* ── CORSI DETAIL (livello 3) ── */}
                                      {isFExpanded && (
                                        <tr>
                                          <td colSpan={6} className="px-0 py-0 bg-white">
                                            <div className="pl-8 overflow-x-auto">
                                              <table className="w-full text-xs min-w-max">
                                                <thead>
                                                  <tr className="border-b border-gray-200">
                                                    <th className="text-left font-medium text-gray-400 px-4 py-2">CORSO</th>
                                                    <th className="text-left font-medium text-gray-400 px-3 py-2">FINANZIAMENTO</th>
                                                    <th className="text-center font-medium text-gray-400 px-3 py-2">ORE</th>
                                                    <th className="text-right font-medium text-blue-400 px-3 py-2 border-l border-blue-100">TARIFFA/H S.</th>
                                                    <th className="text-right font-medium text-blue-400 px-3 py-2">IMPORT. SC. F.</th>
                                                    <th className="text-right font-medium text-blue-400 px-3 py-2">IMPORT. SC. T.</th>
                                                    <th className="text-right font-medium text-blue-500 px-3 py-2">TOT. SCUOLA</th>
                                                    <th className="text-right font-medium text-orange-400 px-3 py-2 border-l border-orange-100">IMPONIB.</th>
                                                    <th className="text-right font-medium text-orange-400 px-3 py-2">RIT.</th>
                                                    <th className="text-right font-medium text-orange-400 px-3 py-2">IVA</th>
                                                    <th className="text-right font-medium text-orange-400 px-3 py-2">INPS</th>
                                                    <th className="text-right font-medium text-orange-500 px-3 py-2">NETTO F.</th>
                                                    <th className="text-right font-medium text-purple-400 px-3 py-2 border-l border-purple-100">ORE T.</th>
                                                    <th className="text-right font-medium text-purple-400 px-3 py-2">IMPON. T.</th>
                                                    <th className="text-right font-medium text-purple-500 px-3 py-2">NETTO T.</th>
                                                    <th className="text-right font-medium text-emerald-500 px-3 py-2 border-l border-emerald-100">MARGINE</th>
                                                    <th className="px-3 py-2"></th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                  {formatoreCorsi.map(ci => (
                                                    <tr key={ci.corso_id} className="hover:bg-gray-50/60">
                                                      <td className="px-4 py-2 text-gray-800 font-medium max-w-[180px] truncate">{ci.title}</td>
                                                      <td className="px-3 py-2 text-gray-400 max-w-[120px] truncate">{ci.finanziamento_nome ?? '—'}</td>
                                                      <td className="px-3 py-2 text-center text-gray-600">{ci.ore_erogate}h</td>
                                                      <td className="px-3 py-2 text-right font-mono text-blue-600 border-l border-blue-50">
                                                        {ci.tariffa_scuola_formatore != null ? `€ ${ci.tariffa_scuola_formatore.toFixed(2)}` : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-mono text-blue-600">
                                                        {ci.importo_scuola_formatore > 0 ? fmtCur(ci.importo_scuola_formatore) : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-mono text-blue-600">
                                                        {ci.importo_scuola_tutor > 0 ? fmtCur(ci.importo_scuola_tutor) : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">
                                                        {ci.totale_fattura_scuola > 0 ? fmtCur(ci.totale_fattura_scuola) : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-mono text-gray-600 border-l border-orange-50">
                                                        {ci.imponibile > 0 ? fmtCur(ci.imponibile) : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right">{fmtSigned(ci.ritenuta)}</td>
                                                      <td className="px-3 py-2 text-right">{fmtSigned(ci.iva)}</td>
                                                      <td className="px-3 py-2 text-right">{fmtSigned(ci.inps)}</td>
                                                      <td className="px-3 py-2 text-right font-mono font-semibold text-orange-700">
                                                        {ci.netto > 0 ? fmtCur(ci.netto) : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right text-gray-500 border-l border-purple-50">
                                                        {ci.ore_tutoraggio > 0 ? `${ci.ore_tutoraggio}h` : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-mono text-gray-600">
                                                        {ci.imponibile_tutor > 0 ? fmtCur(ci.imponibile_tutor) : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right font-mono font-semibold text-purple-700">
                                                        {ci.netto_tutor > 0 ? fmtCur(ci.netto_tutor) : <span className="text-gray-300">—</span>}
                                                      </td>
                                                      <td className="px-3 py-2 text-right border-l border-emerald-50">
                                                        <MargineCell v={ci.margine} />
                                                      </td>
                                                      <td className="px-3 py-2">
                                                        {ci.notula_id && (
                                                          <Link
                                                            href="/economia/notule"
                                                            className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
                                                          >
                                                            Notula
                                                          </Link>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Totale — {progettiRows.length} progett{progettiRows.length === 1 ? 'o' : 'i'}
                </td>
                <td className="px-3 py-2.5 text-center font-semibold text-gray-900 hidden md:table-cell">{totals.n_corsi}</td>
                <td className="px-3 py-2.5 text-center font-semibold text-gray-900">{totals.ore_totali}h</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900 hidden md:table-cell">
                  {totals.fatturato_scuola > 0 ? fmtCur(totals.fatturato_scuola) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                  {totals.costo_formatori > 0 ? fmtCur(totals.costo_formatori) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <MargineCell v={totals.margine} />
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
