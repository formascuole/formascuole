'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { CorsoECItem } from './page'
import { REGIME_LABELS, REGIME_BADGE, fmtCur, type RegimeFiscale } from '@/lib/economia-utils'

interface FormatorRow {
  formatore_id: string
  formatore_nome: string
  regime_fiscale: RegimeFiscale
  rivalsa_iva: boolean
  n_corsi: number
  ore_totali: number
  imponibile: number
  ritenuteIva: number
  netto: number
}

interface Props {
  items: CorsoECItem[]
  formatori: { id: string; nome: string }[]
}

async function exportEstrattiConto(rows: FormatorRow[], anno: string) {
  const XLSX = await import('xlsx')
  const REGIME_EXPORT: Record<RegimeFiscale, string> = {
    forfettario: 'Forfettario',
    ordinario: 'Ordinario',
    notula: 'Prestazione occasionale',
  }
  const headers = ['Formatore', 'Regime', 'N. Corsi', 'Ore Erogate', 'Imponibile (€)', 'Ritenuta/IVA (€)', 'Netto (€)']
  const data = rows.map(r => [
    r.formatore_nome,
    REGIME_EXPORT[r.regime_fiscale],
    r.n_corsi,
    r.ore_totali,
    r.imponibile,
    r.ritenuteIva,
    r.netto,
  ])
  data.push([
    'TOTALE', '',
    rows.reduce((s, r) => s + r.n_corsi, 0),
    rows.reduce((s, r) => s + r.ore_totali, 0),
    rows.reduce((s, r) => s + r.imponibile, 0),
    rows.reduce((s, r) => s + r.ritenuteIva, 0),
    rows.reduce((s, r) => s + r.netto, 0),
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...data.map(r => String(r[i] ?? '').length)) + 2, 35),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Estratti conto')
  XLSX.writeFile(wb, `Economia_${anno}.xlsx`)
}

export function EstrattiContoClient({ items, formatori }: Props) {
  const currentYear = String(new Date().getFullYear())
  const [filterAnno, setFilterAnno] = useState(currentYear)
  const [filterFormatore, setFilterFormatore] = useState('')
  const [filterRegime, setFilterRegime] = useState<'' | RegimeFiscale>('')

  const anni = useMemo(() => {
    const s = new Set<string>()
    for (const i of items) if (i.anno) s.add(i.anno)
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [items])

  const filtered = useMemo(() => items.filter(i => {
    if (filterAnno && filterAnno !== 'all' && i.anno !== filterAnno) return false
    if (filterFormatore && i.formatore_id !== filterFormatore) return false
    if (filterRegime && i.regime_fiscale !== filterRegime) return false
    return true
  }), [items, filterAnno, filterFormatore, filterRegime])

  const rows = useMemo((): FormatorRow[] => {
    const map = new Map<string, FormatorRow>()
    for (const i of filtered) {
      const cur = map.get(i.formatore_id) ?? {
        formatore_id: i.formatore_id,
        formatore_nome: i.formatore_nome,
        regime_fiscale: i.regime_fiscale,
        rivalsa_iva: i.rivalsa_iva,
        n_corsi: 0,
        ore_totali: 0,
        imponibile: 0,
        ritenuteIva: 0,
        netto: 0,
      }
      cur.n_corsi++
      cur.ore_totali += i.ore_erogate
      cur.imponibile += i.imponibile
      cur.ritenuteIva += i.ritenuteIva
      cur.netto += i.netto
      map.set(i.formatore_id, cur)
    }
    return [...map.values()].sort((a, b) => a.formatore_nome.localeCompare(b.formatore_nome))
  }, [filtered])

  const totals = useMemo(() => ({
    n_corsi: rows.reduce((s, r) => s + r.n_corsi, 0),
    ore_totali: rows.reduce((s, r) => s + r.ore_totali, 0),
    imponibile: rows.reduce((s, r) => s + r.imponibile, 0),
    ritenuteIva: rows.reduce((s, r) => s + r.ritenuteIva, 0),
    netto: rows.reduce((s, r) => s + r.netto, 0),
  }), [rows])

  const selCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white'

  function RitIvaCell({ v }: { v: number }) {
    if (v === 0) return <span className="text-gray-300">—</span>
    if (v < 0) return <span className="text-red-600 font-mono">{fmtCur(v)} <span className="text-xs opacity-70">(−20%)</span></span>
    return <span className="text-green-700 font-mono">+{fmtCur(v)} <span className="text-xs opacity-70">(+22%)</span></span>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estratti conto formatori</h1>
          <p className="text-sm text-gray-500 mt-1">{rows.length} formator{rows.length === 1 ? 'e' : 'i'} con corsi completati</p>
        </div>
        <button
          onClick={() => exportEstrattiConto(rows, filterAnno === 'all' ? 'tutti' : filterAnno)}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Esporta Excel
        </button>
      </div>

      {/* Filters */}
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
        {(filterAnno !== currentYear || filterFormatore || filterRegime) && (
          <button
            onClick={() => { setFilterAnno(currentYear); setFilterFormatore(''); setFilterRegime('') }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
          Nessun dato per i filtri selezionati.
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">FORMATORE</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">REGIME</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">N. CORSI</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE EROGATE</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IMPONIBILE</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">RIT./IVA</th>
                <th className="text-right text-xs font-medium text-gray-400 px-5 py-3">NETTO</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.formatore_id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.formatore_nome}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${REGIME_BADGE[r.regime_fiscale]}`}>
                      {REGIME_LABELS[r.regime_fiscale]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.n_corsi}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.ore_totali}h</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {r.imponibile > 0 ? fmtCur(r.imponibile) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    <RitIvaCell v={r.ritenuteIva} />
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-gray-900">
                    {r.netto > 0 ? fmtCur(r.netto) : <span className="text-gray-300 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/utenti/${r.formatore_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#d64b55] hover:underline"
                    >
                      Dettaglio
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Totale</td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">{totals.n_corsi}</td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">{totals.ore_totali}h</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                  {totals.imponibile > 0 ? fmtCur(totals.imponibile) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold">
                  <RitIvaCell v={totals.ritenuteIva} />
                </td>
                <td className="px-5 py-3 text-right font-mono font-bold text-gray-900">
                  {totals.netto > 0 ? fmtCur(totals.netto) : '—'}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
