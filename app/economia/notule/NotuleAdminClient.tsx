'use client'
import { useState, useMemo } from 'react'
import type { NotuleAdminItem } from './page'

interface Props {
  notule: NotuleAdminItem[]
  formatori: { id: string; nome: string }[]
}

const STATO_BADGE: Record<string, string> = {
  bozza: 'bg-yellow-100 text-yellow-700',
  inviata: 'bg-blue-100 text-blue-700',
  accettata: 'bg-green-100 text-green-700',
  rifiutata: 'bg-red-100 text-red-700',
}

const STATO_LABEL: Record<string, string> = {
  bozza: 'Bozza',
  inviata: 'In attesa',
  accettata: 'Accettata',
  rifiutata: 'Rifiutata',
}

async function exportNotule(rows: NotuleAdminItem[], anno: string) {
  const XLSX = await import('xlsx')
  const headers = ['#', 'Formatore', 'Tipo', 'N. Corsi', 'Importo (€)', 'Netto (€)', 'Stato', 'Data']
  const data = rows.map(n => [
    n.numero,
    n.formatore_nome,
    n.tipo === 'cumulativa' ? 'Cumulativa' : 'Singola',
    n.n_corsi,
    Number(n.importo_totale ?? 0),
    Number(n.netto ?? 0),
    STATO_LABEL[n.stato] ?? n.stato,
    new Date(n.created_at).toLocaleDateString('it-IT'),
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...data.map(r => String(r[i] ?? '').length)) + 2, 35),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Notule')
  XLSX.writeFile(wb, `Notule_${anno}.xlsx`)
}

export function NotuleAdminClient({ notule, formatori }: Props) {
  const currentYear = String(new Date().getFullYear())
  const [filterStato, setFilterStato] = useState('')
  const [filterFormatore, setFilterFormatore] = useState('')
  const [filterAnno, setFilterAnno] = useState(currentYear)

  const anni = useMemo(() => {
    const s = new Set<string>()
    for (const n of notule) {
      const y = n.created_at.substring(0, 4)
      if (y) s.add(y)
    }
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [notule])

  const filtered = useMemo(() => notule.filter(n => {
    if (filterStato && n.stato !== filterStato) return false
    if (filterFormatore && n.formatore_id !== filterFormatore) return false
    if (filterAnno && filterAnno !== 'all' && n.created_at.substring(0, 4) !== filterAnno) return false
    return true
  }), [notule, filterStato, filterFormatore, filterAnno])

  const selCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notule</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} notul{filtered.length === 1 ? 'a' : 'e'}</p>
        </div>
        <button
          onClick={() => exportNotule(filtered, filterAnno === 'all' ? 'tutti' : filterAnno)}
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
        <div>
          <div className="text-xs text-gray-400 mb-1">Stato</div>
          <select value={filterStato} onChange={e => setFilterStato(e.target.value)} className={selCls}>
            <option value="">Tutti</option>
            <option value="bozza">Bozza</option>
            <option value="inviata">In attesa</option>
            <option value="accettata">Accettata</option>
            <option value="rifiutata">Rifiutata</option>
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
        {(filterAnno !== currentYear || filterStato || filterFormatore) && (
          <button
            onClick={() => { setFilterAnno(currentYear); setFilterStato(''); setFilterFormatore('') }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
          Nessuna notula per i filtri selezionati.
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">#</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">FORMATORE</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">TIPO</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">CORSI</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IMPORTO</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">NETTO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">STATO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">DATA</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(n => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{n.numero}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{n.formatore_nome}</div>
                    <div className="text-xs text-gray-400">{n.formatore_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${n.tipo === 'cumulativa' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {n.tipo === 'cumulativa' ? 'Cumulativa' : 'Singola'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{n.n_corsi}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    € {Number(n.importo_totale ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                    € {Number(n.netto ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${STATO_BADGE[n.stato] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATO_LABEL[n.stato] ?? n.stato}
                    </span>
                    {n.stato === 'rifiutata' && n.motivazione_rifiuto && (
                      <div className="text-xs text-red-600 mt-0.5 max-w-[160px] truncate" title={n.motivazione_rifiuto}>
                        {n.motivazione_rifiuto}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(n.created_at).toLocaleDateString('it-IT')}
                    {n.risposta_at && (
                      <div className="text-gray-300">→ {new Date(n.risposta_at).toLocaleDateString('it-IT')}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {n.pdf_url && (
                      <a
                        href={n.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#d64b55] hover:underline"
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5"/>
                          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
