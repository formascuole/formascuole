'use client'
import { useState, useMemo } from 'react'
import { QuestionarioRisultato } from '@/lib/types'
import { computeAggregates, StarRating } from '@/components/ui/QuestionariBlock'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function getDateKey(q: QuestionarioRisultato): string {
  return q.data_somministrazione?.substring(0, 10) || q.created_at.substring(0, 10)
}

function wAvgForList(qs: QuestionarioRisultato[], field: 'media_formatore' | 'media_contenuti' | 'media_apprendimento') {
  const tot = qs.reduce((s, q) => s + (q.numero_risposte ?? 1), 0)
  if (tot === 0) return 0
  return qs.reduce((s, q) => s + Number(q[field] ?? 0) * (q.numero_risposte ?? 1), 0) / tot
}

// ── Trend calculation ─────────────────────────────────────────────────────────
// Compare last N records vs previous N for a formatore; positive = improving
function computeTrend(all: QuestionarioRisultato[], filtered: QuestionarioRisultato[]): number {
  if (filtered.length === 0 || filtered.length === all.length) return 0
  const filteredAgg = computeAggregates(filtered)
  const allAgg = computeAggregates(all)
  return filteredAgg.mediaGenerale - allAgg.mediaGenerale
}

// ── Excel export ──────────────────────────────────────────────────────────────
async function exportExcel(
  questionari: QuestionarioRisultato[],
  perFormatore: { nome: string; nInvii: number; totRisposte: number; mF: number; mC: number; mA: number; mG: number }[],
  perScuola: { scuola: string; nCorsi: number; totRisposte: number; mG: number }[],
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const sh1 = XLSX.utils.aoa_to_sheet([
    ['ID','Scuola','Corso','Tipo','Formatore','Regione','Provincia','Linea finanziamento',
     'Data','N. risposte','Media formatore','Media contenuti','Media apprendimento','Impatto',
     'Strumenti','Suggerimenti','Riassunto AI'],
    ...questionari.map(q => [
      q.id, q.scuola, q.titolo_corso, q.tipo_corso, q.formatore,
      q.regione, q.provincia, q.linea_finanziamento, getDateKey(q),
      q.numero_risposte, q.media_formatore, q.media_contenuti, q.media_apprendimento,
      q.impatto_applicare, q.testo_strumenti, q.testo_suggerimenti, q.riassunto_ai,
    ]),
  ])
  XLSX.utils.book_append_sheet(wb, sh1, 'Tutti i questionari')

  const sh2 = XLSX.utils.aoa_to_sheet([
    ['Formatore','N. invii','N. risposte','Media formatore','Media contenuti','Media apprendimento','Media generale'],
    ...perFormatore.map(f => [f.nome, f.nInvii, f.totRisposte, f.mF.toFixed(2), f.mC.toFixed(2), f.mA.toFixed(2), f.mG.toFixed(2)]),
  ])
  XLSX.utils.book_append_sheet(wb, sh2, 'Per formatore')

  const sh3 = XLSX.utils.aoa_to_sheet([
    ['Scuola','N. questionari','N. risposte','Media generale'],
    ...perScuola.map(s => [s.scuola, s.nCorsi, s.totRisposte, s.mG.toFixed(2)]),
  ])
  XLSX.utils.book_append_sheet(wb, sh3, 'Per scuola')

  XLSX.writeFile(wb, `questionari-formascuole-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { questionari: QuestionarioRisultato[] }

export function QuestionariStatClient({ questionari }: Props) {
  const [anno, setAnno] = useState('')
  const [mese, setMese] = useState('')
  const [linea, setLinea] = useState('')
  const [formatoreQ, setFormatoreQ] = useState('')
  const [pageA, setPageA] = useState(0)
  const [expandedAI, setExpandedAI] = useState<Set<string>>(new Set())
  const [expandedScuola, setExpandedScuola] = useState<Set<string>>(new Set())

  const years = useMemo(() => {
    const s = new Set<string>()
    for (const q of questionari) s.add(getDateKey(q).substring(0, 4))
    return [...s].sort().reverse()
  }, [questionari])

  const linee = useMemo(() => {
    const s = new Set<string>()
    for (const q of questionari) if (q.linea_finanziamento) s.add(q.linea_finanziamento)
    return [...s].sort()
  }, [questionari])

  const filtered = useMemo(() => {
    return questionari.filter(q => {
      const d = getDateKey(q)
      if (anno && !d.startsWith(anno)) return false
      if (mese && d.substring(5, 7) !== mese) return false
      if (linea && q.linea_finanziamento !== linea) return false
      if (formatoreQ && !(q.formatore?.toLowerCase().includes(formatoreQ.toLowerCase()))) return false
      return true
    })
  }, [questionari, anno, mese, linea, formatoreQ])

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice(pageA * PAGE_SIZE, (pageA + 1) * PAGE_SIZE)

  // Per formatore
  const perFormatore = useMemo(() => {
    const map = new Map<string, QuestionarioRisultato[]>()
    for (const q of filtered) {
      const k = q.formatore || '—'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(q)
    }
    const allMap = new Map<string, QuestionarioRisultato[]>()
    for (const q of questionari) {
      const k = q.formatore || '—'
      if (!allMap.has(k)) allMap.set(k, [])
      allMap.get(k)!.push(q)
    }
    return [...map.entries()].map(([nome, qs]) => {
      const mF = wAvgForList(qs, 'media_formatore')
      const mC = wAvgForList(qs, 'media_contenuti')
      const mA = wAvgForList(qs, 'media_apprendimento')
      const mG = (mF + mC + mA) / 3
      const trend = computeTrend(allMap.get(nome) || qs, qs)
      return {
        nome,
        nInvii: qs.length,
        totRisposte: qs.reduce((s, q) => s + (q.numero_risposte ?? 1), 0),
        mF, mC, mA, mG, trend,
      }
    }).sort((a, b) => b.mG - a.mG)
  }, [filtered, questionari])

  // Per scuola
  const perScuola = useMemo(() => {
    const map = new Map<string, QuestionarioRisultato[]>()
    for (const q of filtered) {
      const k = q.scuola || '—'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(q)
    }
    return [...map.entries()].map(([scuola, qs]) => {
      const mF = wAvgForList(qs, 'media_formatore')
      const mC = wAvgForList(qs, 'media_contenuti')
      const mA = wAvgForList(qs, 'media_apprendimento')
      const mG = (mF + mC + mA) / 3
      return {
        scuola,
        nCorsi: qs.length,
        totRisposte: qs.reduce((s, q) => s + (q.numero_risposte ?? 1), 0),
        mG, qs,
      }
    }).sort((a, b) => b.totRisposte - a.totRisposte)
  }, [filtered])

  function toggleAI(id: string) {
    setExpandedAI(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleScuola(k: string) {
    setExpandedScuola(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  const agg = useMemo(() => computeAggregates(filtered), [filtered])
  const hasFilters = anno || mese || linea || formatoreQ

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Valutazioni questionari</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} questionari · {agg.totaleRisposte} risposte
            {hasFilters && <span className="ml-1 text-[#d64b55]">(filtrati)</span>}
          </p>
        </div>
        <button
          onClick={() => exportExcel(filtered, perFormatore, perScuola)}
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
          <select
            value={anno}
            onChange={e => { setAnno(e.target.value); setPageA(0) }}
            className="text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white"
          >
            <option value="">Tutti</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Mese</div>
          <select
            value={mese}
            onChange={e => { setMese(e.target.value); setPageA(0) }}
            className="text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white"
          >
            <option value="">Tutti</option>
            {MONTH_NAMES.map((n, i) => (
              <option key={i} value={String(i + 1).padStart(2, '0')}>{n}</option>
            ))}
          </select>
        </div>
        {linee.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Linea finanziamento</div>
            <select
              value={linea}
              onChange={e => { setLinea(e.target.value); setPageA(0) }}
              className="text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white max-w-[200px]"
            >
              <option value="">Tutte</option>
              {linee.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
        <div>
          <div className="text-xs text-gray-400 mb-1">Formatore</div>
          <input
            value={formatoreQ}
            onChange={e => { setFormatoreQ(e.target.value); setPageA(0) }}
            placeholder="Cerca…"
            className="text-sm border border-gray-200 rounded-[7px] px-3 py-1.5 focus:outline-none focus:border-[#d64b55] w-40"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => { setAnno(''); setMese(''); setLinea(''); setFormatoreQ(''); setPageA(0) }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {/* Summary tiles */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Media formatore', value: agg.mediaFormatore },
            { label: 'Media contenuti', value: agg.mediaContenuti },
            { label: 'Media apprendimento', value: agg.mediaApprendimento },
            { label: 'Media generale', value: agg.mediaGenerale },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl p-4 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {value.toFixed(1)}<span className="text-sm font-normal text-gray-400">/5</span>
              </div>
              <div className="flex justify-center"><StarRating value={value} /></div>
            </div>
          ))}
        </div>
      )}

      {/* ── Section A: Tutti i questionari ───────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-gray-900">Tutti i questionari</h2>
          <span className="text-sm text-gray-400">({filtered.length})</span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl px-6 py-12 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
            Nessun questionario con i filtri selezionati.
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">DATA</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">SCUOLA / CORSO</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">FORMATORE</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">RISP.</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">FORM.</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">CONT.</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">APPR.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageData.map(q => (
                  <>
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{getDateKey(q)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{q.scuola || '—'}</div>
                        <div className="text-xs text-gray-400">{q.titolo_corso || q.tipo_corso || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{q.formatore || '—'}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-700">{q.numero_risposte}</td>
                      <td className="px-4 py-3 text-center">
                        {q.media_formatore != null ? (
                          <span className="font-semibold text-gray-800">{Number(q.media_formatore).toFixed(1)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {q.media_contenuti != null ? (
                          <span className="font-semibold text-gray-800">{Number(q.media_contenuti).toFixed(1)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {q.media_apprendimento != null ? (
                          <span className="font-semibold text-gray-800">{Number(q.media_apprendimento).toFixed(1)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {q.riassunto_ai && (
                          <button
                            onClick={() => toggleAI(q.id)}
                            className={`text-xs px-2 py-1 rounded-md transition-colors ${expandedAI.has(q.id) ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`}
                          >
                            AI
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedAI.has(q.id) && q.riassunto_ai && (
                      <tr key={`${q.id}-ai`}>
                        <td colSpan={8} className="px-4 pb-4 pt-0">
                          <div className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap">
                            {q.riassunto_ai}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="text-xs text-gray-400">
                  {pageA * PAGE_SIZE + 1}–{Math.min((pageA + 1) * PAGE_SIZE, filtered.length)} di {filtered.length}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPageA(p => Math.max(0, p - 1))}
                    disabled={pageA === 0}
                    className="text-xs px-3 py-1.5 rounded-[7px] border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    ←
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i : pageA < 4 ? i : pageA > totalPages - 5 ? totalPages - 7 + i : pageA - 3 + i
                    return (
                      <button
                        key={p}
                        onClick={() => setPageA(p)}
                        className={`text-xs px-3 py-1.5 rounded-[7px] border transition-colors ${p === pageA ? 'border-[#d64b55] text-[#d64b55] font-semibold' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {p + 1}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPageA(p => Math.min(totalPages - 1, p + 1))}
                    disabled={pageA === totalPages - 1}
                    className="text-xs px-3 py-1.5 rounded-[7px] border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section B: Per formatore ──────────────────────────────────────────── */}
      {perFormatore.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Medie per formatore</h2>
            <span className="text-sm text-gray-400">({perFormatore.length})</span>
          </div>
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">FORMATORE</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">INVII</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">RISP.</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">FORM.</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">CONT.</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">APPR.</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">MEDIA GEN.</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">TREND</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {perFormatore.map(f => (
                  <tr key={f.nome} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{f.nInvii}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{f.totRisposte}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">{f.mF.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">{f.mC.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">{f.mA.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">{f.mG.toFixed(1)}</span>
                        <StarRating value={f.mG} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.trend > 0.1 ? (
                        <span className="text-green-600 font-semibold text-sm">↑ +{f.trend.toFixed(1)}</span>
                      ) : f.trend < -0.1 ? (
                        <span className="text-red-500 font-semibold text-sm">↓ {f.trend.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Section C: Per scuola ─────────────────────────────────────────────── */}
      {perScuola.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Medie per scuola</h2>
            <span className="text-sm text-gray-400">({perScuola.length})</span>
          </div>
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">SCUOLA</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">QUESTIONARI</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">RISPOSTE</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">MEDIA GENERALE</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {perScuola.map(s => (
                  <>
                    <tr key={s.scuola} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{s.scuola}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{s.nCorsi}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{s.totRisposte}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">{s.mG.toFixed(1)}</span>
                          <StarRating value={s.mG} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.qs.length > 1 && (
                          <button
                            onClick={() => toggleScuola(s.scuola)}
                            className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1 ml-auto"
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
                              className={`transition-transform ${expandedScuola.has(s.scuola) ? 'rotate-90' : ''}`}>
                              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {expandedScuola.has(s.scuola) ? 'Chiudi' : 'Dettagli'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedScuola.has(s.scuola) && (
                      <tr key={`${s.scuola}-detail`}>
                        <td colSpan={5} className="px-6 pb-4 pt-0 bg-gray-50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left font-medium text-gray-400 py-2 pr-4">CORSO</th>
                                <th className="text-left font-medium text-gray-400 py-2 pr-4">FORMATORE</th>
                                <th className="text-center font-medium text-gray-400 py-2 pr-4">DATA</th>
                                <th className="text-center font-medium text-gray-400 py-2 pr-4">RISP.</th>
                                <th className="text-center font-medium text-gray-400 py-2">MEDIA</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {s.qs.map(q => {
                                const mG = ((Number(q.media_formatore ?? 0) + Number(q.media_contenuti ?? 0) + Number(q.media_apprendimento ?? 0)) / 3)
                                return (
                                  <tr key={q.id}>
                                    <td className="py-2 pr-4 text-gray-700">{q.titolo_corso || q.tipo_corso || '—'}</td>
                                    <td className="py-2 pr-4 text-gray-600">{q.formatore || '—'}</td>
                                    <td className="py-2 pr-4 text-center text-gray-500">{getDateKey(q)}</td>
                                    <td className="py-2 pr-4 text-center text-gray-600">{q.numero_risposte}</td>
                                    <td className="py-2 text-center font-semibold text-gray-800">{mG.toFixed(1)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {questionari.length === 0 && (
        <div className="bg-white rounded-xl px-6 py-16 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <p className="text-sm text-gray-400">Nessun questionario ricevuto ancora.</p>
          <p className="text-xs text-gray-300 mt-1">I dati appariranno qui non appena verranno ricevuti via webhook.</p>
        </div>
      )}
    </div>
  )
}
