'use client'
import { useState, useMemo } from 'react'
import type { NotuleAdminItem, FatturaAtteseItem, RiepilogoItem } from './page'
import { REGIME_LABELS, REGIME_BADGE } from '@/lib/economia-utils'
import type { RegimeFiscale } from '@/lib/economia-utils'

interface Props {
  notule: NotuleAdminItem[]
  formatori: { id: string; nome: string }[]
  fattureAttese: FatturaAtteseItem[]
  riepilogo: RiepilogoItem[]
}

type Tab = 'notule' | 'fatture' | 'riepilogo'

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
  ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...data.map(r => String(r[i] ?? '').length)) + 2, 35) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Notule')
  XLSX.writeFile(wb, `Notule_${anno}.xlsx`)
}

async function exportFatture(rows: FatturaAtteseItem[], anno: string) {
  const XLSX = await import('xlsx')
  const headers = ['Formatore', 'Regime', 'Corso', 'Scuola', 'Ore', 'Imponibile (€)', 'IVA (€)', 'Netto (€)', 'Stato', 'Anno']
  const data = rows.map(f => [
    f.formatore_nome,
    REGIME_LABELS[f.regime as RegimeFiscale] ?? f.regime,
    f.title,
    f.school_name,
    f.ore_erogate,
    f.imponibile,
    f.iva,
    f.netto,
    f.fattura_ricevuta ? 'Ricevuta' : 'Da ricevere',
    f.anno ?? '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...data.map(r => String(r[i] ?? '').length)) + 2, 35) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fatture attese')
  XLSX.writeFile(wb, `FattureAttese_${anno}.xlsx`)
}

async function exportRiepilogo(rows: RiepilogoItem[]) {
  const XLSX = await import('xlsx')
  const headers = ['Formatore', 'Regime', 'N. Corsi', 'Lordo (€)', 'Ritenute (€)', 'IVA (€)', 'Netto (€)', 'Stato']
  const data = rows.map(r => [
    r.formatore_nome,
    REGIME_LABELS[r.regime as RegimeFiscale] ?? r.regime,
    r.n_corsi,
    r.totale_lordo,
    r.totale_ritenute,
    r.totale_iva,
    r.totale_netto,
    r.stato === 'ok' ? 'OK' : r.stato === 'in_attesa' ? 'In attesa' : 'Da verificare',
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...data.map(row => String(row[i] ?? '').length)) + 2, 35) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Riepilogo')
  XLSX.writeFile(wb, 'Riepilogo_formatori.xlsx')
}

export function DocumentiContabiliClient({ notule, formatori, fattureAttese: initialFattureAttese, riepilogo }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('notule')
  const currentYear = String(new Date().getFullYear())

  // Notule filters
  const [notuleFilterStato, setNotuleFilterStato] = useState('')
  const [notuleFilterFormatore, setNotuleFilterFormatore] = useState('')
  const [notuleFilterAnno, setNotuleFilterAnno] = useState(currentYear)

  // Fatture filters
  const [fattureFilterAnno, setFattureFilterAnno] = useState(currentYear)
  const [fattureFilterFormatore, setFattureFilterFormatore] = useState('')
  const [fattureFilterStato, setFattureFilterStato] = useState('')
  const [fattureFilterRegime, setFattureFilterRegime] = useState('')

  // Optimistic fatture state
  const [fattureAttese, setFattureAttese] = useState<FatturaAtteseItem[]>(initialFattureAttese)

  const notuleAnni = useMemo(() => {
    const s = new Set<string>()
    for (const n of notule) {
      const y = n.created_at.substring(0, 4)
      if (y) s.add(y)
    }
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [notule])

  const fattureAnni = useMemo(() => {
    const s = new Set<string>()
    for (const f of fattureAttese) {
      if (f.anno) s.add(f.anno)
    }
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [fattureAttese])

  const fattureFormatori = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of fattureAttese) m.set(f.formatore_id, f.formatore_nome)
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [fattureAttese])

  const filteredNotule = useMemo(() => notule.filter(n => {
    if (notuleFilterStato && n.stato !== notuleFilterStato) return false
    if (notuleFilterFormatore && n.formatore_id !== notuleFilterFormatore) return false
    if (notuleFilterAnno && notuleFilterAnno !== 'all' && n.created_at.substring(0, 4) !== notuleFilterAnno) return false
    return true
  }), [notule, notuleFilterStato, notuleFilterFormatore, notuleFilterAnno])

  const filteredFatture = useMemo(() => fattureAttese.filter(f => {
    if (fattureFilterAnno && fattureFilterAnno !== 'all' && f.anno !== fattureFilterAnno) return false
    if (fattureFilterFormatore && f.formatore_id !== fattureFilterFormatore) return false
    if (fattureFilterStato === 'da_ricevere' && f.fattura_ricevuta) return false
    if (fattureFilterStato === 'ricevuta' && !f.fattura_ricevuta) return false
    if (fattureFilterRegime && f.regime !== fattureFilterRegime) return false
    return true
  }), [fattureAttese, fattureFilterAnno, fattureFilterFormatore, fattureFilterStato, fattureFilterRegime])

  const handleToggleFattura = async (corsoId: string, val: boolean) => {
    // Optimistic update
    setFattureAttese(prev => prev.map(f =>
      f.corso_id === corsoId
        ? { ...f, fattura_ricevuta: val, fattura_ricevuta_at: val ? new Date().toISOString() : null }
        : f
    ))
    await fetch(`/api/corsi/${corsoId}/fattura-ricevuta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fattura_ricevuta: val }),
    })
  }

  const selCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white'

  const tabCls = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-[7px] transition-colors ${
      activeTab === tab
        ? 'text-white'
        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documenti contabili</h1>
          <p className="text-sm text-gray-500 mt-1">Notule, fatture attese e riepilogo formatori</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-[10px] w-fit mb-6">
        <button
          onClick={() => setActiveTab('notule')}
          className={tabCls('notule')}
          style={activeTab === 'notule' ? { backgroundColor: '#d64b55' } : {}}
        >
          Notule ({notule.length})
        </button>
        <button
          onClick={() => setActiveTab('fatture')}
          className={tabCls('fatture')}
          style={activeTab === 'fatture' ? { backgroundColor: '#d64b55' } : {}}
        >
          Fatture attese ({fattureAttese.length})
        </button>
        <button
          onClick={() => setActiveTab('riepilogo')}
          className={tabCls('riepilogo')}
          style={activeTab === 'riepilogo' ? { backgroundColor: '#d64b55' } : {}}
        >
          Riepilogo
        </button>
      </div>

      {/* ── TAB 1: NOTULE ─────────────────────────────────────────────────────── */}
      {activeTab === 'notule' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{filteredNotule.length} notul{filteredNotule.length === 1 ? 'a' : 'e'}</p>
            <button
              onClick={() => exportNotule(filteredNotule, notuleFilterAnno === 'all' ? 'tutti' : notuleFilterAnno)}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Esporta Excel
            </button>
          </div>

          <div className="bg-white rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end" style={{ border: '0.5px solid #e5e5e5' }}>
            <div>
              <div className="text-xs text-gray-400 mb-1">Anno</div>
              <select value={notuleFilterAnno} onChange={e => setNotuleFilterAnno(e.target.value)} className={selCls}>
                <option value="all">Tutti</option>
                {notuleAnni.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Stato</div>
              <select value={notuleFilterStato} onChange={e => setNotuleFilterStato(e.target.value)} className={selCls}>
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
                <select value={notuleFilterFormatore} onChange={e => setNotuleFilterFormatore(e.target.value)} className={selCls}>
                  <option value="">Tutti</option>
                  {formatori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            )}
            {(notuleFilterAnno !== currentYear || notuleFilterStato || notuleFilterFormatore) && (
              <button onClick={() => { setNotuleFilterAnno(currentYear); setNotuleFilterStato(''); setNotuleFilterFormatore('') }} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5">
                Azzera filtri
              </button>
            )}
          </div>

          {filteredNotule.length === 0 ? (
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
                  {filteredNotule.map(n => (
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
                      <td className="px-4 py-3 text-right font-mono text-gray-700">€ {Number(n.importo_totale ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">€ {Number(n.netto ?? 0).toFixed(2)}</td>
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
                          <a href={n.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#d64b55] hover:underline">
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
      )}

      {/* ── TAB 2: FATTURE ATTESE ─────────────────────────────────────────────── */}
      {activeTab === 'fatture' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{filteredFatture.length} cors{filteredFatture.length === 1 ? 'o' : 'i'}</p>
            <button
              onClick={() => exportFatture(filteredFatture, fattureFilterAnno === 'all' ? 'tutti' : fattureFilterAnno)}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Esporta Excel
            </button>
          </div>

          <div className="bg-white rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end" style={{ border: '0.5px solid #e5e5e5' }}>
            <div>
              <div className="text-xs text-gray-400 mb-1">Anno</div>
              <select value={fattureFilterAnno} onChange={e => setFattureFilterAnno(e.target.value)} className={selCls}>
                <option value="all">Tutti</option>
                {fattureAnni.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Formatore</div>
              <select value={fattureFilterFormatore} onChange={e => setFattureFilterFormatore(e.target.value)} className={selCls}>
                <option value="">Tutti</option>
                {fattureFormatori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Stato</div>
              <select value={fattureFilterStato} onChange={e => setFattureFilterStato(e.target.value)} className={selCls}>
                <option value="">Tutti</option>
                <option value="da_ricevere">Da ricevere</option>
                <option value="ricevuta">Ricevuta</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Regime</div>
              <select value={fattureFilterRegime} onChange={e => setFattureFilterRegime(e.target.value)} className={selCls}>
                <option value="">Tutti</option>
                <option value="forfettario">Forfettario</option>
                <option value="ordinario">Ordinario</option>
              </select>
            </div>
            {(fattureFilterAnno !== currentYear || fattureFilterFormatore || fattureFilterStato || fattureFilterRegime) && (
              <button onClick={() => { setFattureFilterAnno(currentYear); setFattureFilterFormatore(''); setFattureFilterStato(''); setFattureFilterRegime('') }} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5">
                Azzera filtri
              </button>
            )}
          </div>

          {filteredFatture.length === 0 ? (
            <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
              Nessuna fattura attesa per i filtri selezionati.
            </div>
          ) : (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">FORMATORE</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">REGIME</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">CORSO</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">SCUOLA</th>
                    <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IMPONIBILE</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IVA</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">NETTO</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">STATO</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredFatture.map(f => (
                    <tr key={f.corso_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{f.formatore_nome}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${REGIME_BADGE[f.regime as RegimeFiscale] ?? 'bg-gray-100 text-gray-600'}`}>
                          {REGIME_LABELS[f.regime as RegimeFiscale] ?? f.regime}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={f.title}>{f.title}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate" title={f.school_name}>{f.school_name}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{f.ore_erogate}h</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">€ {f.imponibile.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600">
                        {f.iva > 0 ? `€ ${f.iva.toFixed(2)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">€ {f.netto.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {f.fattura_ricevuta ? (
                          <div>
                            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                              Ricevuta
                            </span>
                            {f.fattura_ricevuta_at && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {new Date(f.fattura_ricevuta_at).toLocaleDateString('it-IT')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-orange-100 text-orange-700">
                            Da ricevere
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={f.fattura_ricevuta}
                            onChange={e => handleToggleFattura(f.corso_id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">Ricevuta</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: RIEPILOGO ──────────────────────────────────────────────────── */}
      {activeTab === 'riepilogo' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{riepilogo.length} formator{riepilogo.length === 1 ? 'e' : 'i'}</p>
            <button
              onClick={() => exportRiepilogo(riepilogo)}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Esporta Excel
            </button>
          </div>

          {riepilogo.length === 0 ? (
            <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
              Nessun dato disponibile.
            </div>
          ) : (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">FORMATORE</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">REGIME</th>
                    <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">CORSI</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">LORDO</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">RITENUTE</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IVA</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">NETTO</th>
                    <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">STATO DOC.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {riepilogo.map(r => {
                    const statoBadge = r.stato === 'ok'
                      ? 'bg-green-100 text-green-700'
                      : r.stato === 'in_attesa'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    const statoLabel = r.stato === 'ok' ? 'OK' : r.stato === 'in_attesa' ? 'In attesa' : 'Da verificare'
                    const regimeBadge = r.regime === 'notula'
                      ? 'bg-orange-100 text-orange-700'
                      : r.regime === 'forfettario'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    return (
                      <tr key={r.formatore_id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{r.formatore_nome}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${regimeBadge}`}>
                            {REGIME_LABELS[r.regime as RegimeFiscale] ?? r.regime}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{r.n_corsi}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">€ {r.totale_lordo.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">
                          {r.totale_ritenute > 0 ? `€ ${r.totale_ritenute.toFixed(2)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600">
                          {r.totale_iva > 0 ? `€ ${r.totale_iva.toFixed(2)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">€ {r.totale_netto.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${statoBadge}`}>
                            {statoLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
