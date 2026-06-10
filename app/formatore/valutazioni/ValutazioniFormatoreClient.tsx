'use client'
import { useState, useMemo } from 'react'
import { QuestionarioRisultato } from '@/lib/types'
import { computeAggregates, StarRating, MediaSmall, ImpattoBarsCompact } from '@/components/ui/QuestionariBlock'

interface CorsoItem {
  id: string
  title: string
  school_name: string
}

interface Props {
  questionari: QuestionarioRisultato[]
  corsi: CorsoItem[]
  formatoreName: string
}

export function ValutazioniFormatoreClient({ questionari, corsi, formatoreName }: Props) {
  const [selectedCorsoId, setSelectedCorsoId] = useState('')

  const filtered = useMemo(
    () => selectedCorsoId ? questionari.filter(q => q.corso_id === selectedCorsoId) : questionari,
    [questionari, selectedCorsoId]
  )

  const agg = useMemo(() => computeAggregates(filtered), [filtered])
  const aggAll = useMemo(() => computeAggregates(questionari), [questionari])

  // Trend: compare selected corso vs overall
  const trend = selectedCorsoId && questionari.length > 0
    ? agg.mediaGenerale - aggAll.mediaGenerale
    : null

  // Corsi that actually have questionari
  const corsiConDati = useMemo(() => {
    const ids = new Set(questionari.map(q => q.corso_id).filter(Boolean))
    return corsi.filter(c => ids.has(c.id))
  }, [questionari, corsi])

  if (questionari.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Le mie valutazioni</h1>
          <p className="text-sm text-gray-500 mt-1">Questionari di gradimento ricevuti dai partecipanti</p>
        </div>
        <div className="bg-white rounded-xl px-6 py-16 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto mb-3" width="32" height="32" fill="none" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm text-gray-400">Nessuna valutazione ricevuta ancora.</p>
          <p className="text-xs text-gray-300 mt-1">I dati appariranno qui dopo che i partecipanti avranno compilato il questionario.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Le mie valutazioni</h1>
        <p className="text-sm text-gray-500 mt-1">
          {formatoreName} · {questionari.length} questionari · {aggAll.totaleRisposte} risposte totali
        </p>
      </div>

      {/* Corso filter */}
      {corsiConDati.length > 1 && (
        <div className="mb-6 bg-white rounded-xl p-4" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs text-gray-400 shrink-0">Filtra per corso:</div>
            <button
              onClick={() => setSelectedCorsoId('')}
              className={`text-xs px-3 py-1.5 rounded-[7px] border transition-colors ${!selectedCorsoId ? 'border-[#d64b55] text-[#d64b55] font-semibold bg-red-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Tutti ({questionari.length})
            </button>
            {corsiConDati.map(c => {
              const count = questionari.filter(q => q.corso_id === c.id).length
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCorsoId(c.id)}
                  className={`text-xs px-3 py-1.5 rounded-[7px] border transition-colors text-left ${selectedCorsoId === c.id ? 'border-[#d64b55] text-[#d64b55] font-semibold bg-red-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {c.title} <span className="text-gray-400">({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl p-5 col-span-2 sm:col-span-1" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Media generale</div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-gray-900">{agg.mediaGenerale.toFixed(1)}</span>
            <span className="text-sm text-gray-400">/5</span>
            {trend !== null && Math.abs(trend) > 0.05 && (
              <span className={`text-sm font-semibold ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trend > 0 ? `↑ +${trend.toFixed(1)}` : `↓ ${trend.toFixed(1)}`}
              </span>
            )}
          </div>
          <StarRating value={agg.mediaGenerale} />
          <div className="mt-3 text-xs text-gray-400">{filtered.length} questionari · {agg.totaleRisposte} risposte</div>
        </div>
        <div className="bg-white rounded-xl p-5 col-span-2 sm:col-span-1" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Impatto formazione</div>
          <ImpattoBarsCompact counts={agg.impattoCounts} totale={agg.totaleRisposte} />
        </div>
      </div>

      {/* Per-section averages */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <MediaSmall label="Formatore" value={agg.mediaFormatore} />
        <MediaSmall label="Contenuti" value={agg.mediaContenuti} />
        <MediaSmall label="Apprendimento" value={agg.mediaApprendimento} />
      </div>

      {/* AI summary */}
      {agg.latestRiassunto?.riassunto_ai && (
        <div className="mb-6 bg-purple-50 border border-purple-100 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" stroke="#7c3aed" strokeWidth="1.5"/>
              <path d="M8 12s1.333 2 4 2 4-2 4-2" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 9h.01M15 9h.01" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-xs font-semibold text-purple-700">Ultimo riassunto AI</span>
            <span className="text-xs text-purple-400 ml-auto">{agg.ultimaData}</span>
          </div>
          <p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{agg.latestRiassunto.riassunto_ai}</p>
        </div>
      )}

      {/* Recent questionari list */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Storico questionari</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {filtered.slice(0, 20).map(q => {
              const mG = ((Number(q.media_formatore ?? 0) + Number(q.media_contenuti ?? 0) + Number(q.media_apprendimento ?? 0)) / 3)
              const dataStr = q.data_somministrazione?.substring(0, 10) || q.created_at.substring(0, 10)
              const corsoName = corsi.find(c => c.id === q.corso_id)?.title || q.titolo_corso || q.tipo_corso || '—'
              return (
                <div key={q.id} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{corsoName}</div>
                    <div className="text-xs text-gray-400">{q.scuola || '—'} · {dataStr} · {q.numero_risposte} risp.</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900">{mG.toFixed(1)}</div>
                    <StarRating value={mG} />
                  </div>
                </div>
              )
            })}
          </div>
          {filtered.length > 20 && (
            <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
              Mostrati 20 di {filtered.length} questionari
            </div>
          )}
        </div>
      )}
    </div>
  )
}
