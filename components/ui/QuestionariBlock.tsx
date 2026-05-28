'use client'
import { useState } from 'react'
import { QuestionarioRisultato } from '@/lib/types'

// ─── Utilities ───────────────────────────────────────────────────────────────

export interface QuestionariAggregates {
  totaleRisposte: number
  mediaFormatore: number
  mediaContenuti: number
  mediaApprendimento: number
  mediaGenerale: number
  impattoCounts: Record<string, number>
  latestRiassunto: QuestionarioRisultato | null
  ultimaData: string
}

export function computeAggregates(questionari: QuestionarioRisultato[]): QuestionariAggregates {
  const totaleRisposte = questionari.reduce((s, q) => s + (q.numero_risposte ?? 1), 0)

  const wAvg = (field: 'media_formatore' | 'media_contenuti' | 'media_apprendimento') => {
    if (totaleRisposte === 0) return 0
    const sum = questionari.reduce((s, q) => s + Number(q[field] ?? 0) * (q.numero_risposte ?? 1), 0)
    return sum / totaleRisposte
  }

  const mediaFormatore = wAvg('media_formatore')
  const mediaContenuti = wAvg('media_contenuti')
  const mediaApprendimento = wAvg('media_apprendimento')
  const mediaGenerale = (mediaFormatore + mediaContenuti + mediaApprendimento) / 3

  const impattoCounts: Record<string, number> = {}
  for (const q of questionari) {
    const k = q.impatto_applicare ?? 'no'
    impattoCounts[k] = (impattoCounts[k] ?? 0) + (q.numero_risposte ?? 1)
  }

  // questionari già ordinati desc per created_at
  const latestRiassunto = questionari.find(q => q.riassunto_ai) ?? null
  const first = questionari[0]
  const ultimaData = first?.data_somministrazione || first?.created_at?.split('T')[0] || '—'

  return { totaleRisposte, mediaFormatore, mediaContenuti, mediaApprendimento, mediaGenerale, impattoCounts, latestRiassunto, ultimaData }
}

// ─── Presentational atoms ────────────────────────────────────────────────────

export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const rounded = Math.round(value * 2) / 2
  const full = Math.floor(rounded)
  const half = rounded % 1 !== 0
  const empty = max - full - (half ? 1 : 0)
  return (
    <span className="inline-flex items-center gap-px">
      {Array.from({ length: full }).map((_, i) => (
        <svg key={`f${i}`} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
      {half && (
        <svg width="13" height="13" viewBox="0 0 24 24">
          <defs><linearGradient id="qhalf"><stop offset="50%" stopColor="#f59e0b"/><stop offset="50%" stopColor="#d1d5db"/></linearGradient></defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#qhalf)"/>
        </svg>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <svg key={`e${i}`} width="13" height="13" viewBox="0 0 24 24" fill="#d1d5db">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </span>
  )
}

export function MediaSmall({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value.toFixed(1)}<span className="text-xs font-normal text-gray-400">/5</span></div>
      <div className="flex justify-center mt-0.5"><StarRating value={value} /></div>
    </div>
  )
}

export function ImpattoBarsCompact({ counts, totale }: { counts: Record<string, number>; totale: number }) {
  const items = [
    { key: 'yes', label: 'Sì', color: '#16a34a' },
    { key: 'in_parte', label: 'In parte', color: '#d97706' },
    { key: 'no', label: 'No', color: '#dc2626' },
  ]
  return (
    <div className="space-y-1.5">
      {items.map(({ key, label, color }) => {
        const n = counts[key] ?? 0
        const pct = totale > 0 ? Math.round((n / totale) * 100) : 0
        return (
          <div key={key} className="flex items-center gap-2">
            <div className="w-12 text-xs text-gray-500">{label}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }}/>
            </div>
            <div className="w-10 text-right text-xs font-medium text-gray-600">{pct}%</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Full block ───────────────────────────────────────────────────────────────

interface QuestionariBlockProps {
  questionari: QuestionarioRisultato[]
  showTexts?: boolean
  showStorico?: boolean
}

export function QuestionariBlock({ questionari, showTexts = false, showStorico = false }: QuestionariBlockProps) {
  const [storicoOpen, setStoricoOpen] = useState(false)

  if (questionari.length === 0) {
    return (
      <div className="bg-white rounded-xl mt-4" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <ClipboardIcon />
          <h2 className="font-semibold text-gray-900">Risultati questionari</h2>
        </div>
        <div className="px-6 py-10 text-center text-sm text-gray-400">Nessun questionario ricevuto ancora.</div>
      </div>
    )
  }

  const agg = computeAggregates(questionari)
  const { totaleRisposte, mediaFormatore, mediaContenuti, mediaApprendimento, mediaGenerale, impattoCounts, latestRiassunto, ultimaData } = agg

  const storicoRiassunti = questionari.filter(q => q.riassunto_ai)

  const testiStrumenti = showTexts ? questionari.filter(q => q.testo_strumenti?.trim()).map(q => q.testo_strumenti!) : []
  const testiSuggerimenti = showTexts ? questionari.filter(q => q.testo_suggerimenti?.trim()).map(q => q.testo_suggerimenti!) : []

  return (
    <div className="bg-white rounded-xl mt-4" style={{ border: '0.5px solid #e5e5e5' }}>
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <ClipboardIcon />
        <h2 className="font-semibold text-gray-900">Risultati questionari</h2>
        <span className="ml-auto text-xs text-gray-400">{questionari.length} invio{questionari.length > 1 ? 'i' : ''} · {totaleRisposte} risposta{totaleRisposte > 1 ? 'e' : ''}</span>
      </div>
      <div className="p-6 space-y-5">

        {/* Riepilogo */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: '#d64b55' }}>
              {totaleRisposte}
            </div>
            <div className="text-xs text-gray-400">risposte</div>
          </div>
          <div className="w-px h-8 bg-gray-200 hidden sm:block"/>
          <div>
            <div className="text-xs text-gray-400 mb-1">MEDIA GENERALE</div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">{mediaGenerale.toFixed(1)}</span>
              <span className="text-xs text-gray-400">/5</span>
              <StarRating value={mediaGenerale}/>
            </div>
          </div>
          <div className="w-px h-8 bg-gray-200 hidden sm:block"/>
          <div>
            <div className="text-xs text-gray-400">ULTIMA COMPILAZIONE</div>
            <div className="text-sm font-semibold text-gray-800">{ultimaData}</div>
          </div>
        </div>

        {/* 3 medie */}
        <div className="grid grid-cols-3 gap-3">
          <MediaSmall label="Qualità formatore" value={mediaFormatore}/>
          <MediaSmall label="Qualità contenuti" value={mediaContenuti}/>
          <MediaSmall label="Apprendimento" value={mediaApprendimento}/>
        </div>

        {/* Impatto */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Impatto — applicherà quanto appreso?</div>
          <ImpattoBarsCompact counts={impattoCounts} totale={totaleRisposte}/>
        </div>

        {/* Testi liberi (admin only) */}
        {showTexts && (testiStrumenti.length > 0 || testiSuggerimenti.length > 0) && (
          <div className="space-y-4">
            {testiStrumenti.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Strumenti menzionati</div>
                <div className="space-y-2">
                  {testiStrumenti.map((t, i) => (
                    <div key={i} className="text-sm text-gray-700 bg-gray-50 px-4 py-3 rounded-[7px] border-l-2 border-gray-200">{t}</div>
                  ))}
                </div>
              </div>
            )}
            {testiSuggerimenti.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Suggerimenti</div>
                <div className="space-y-2">
                  {testiSuggerimenti.map((t, i) => (
                    <div key={i} className="text-sm text-gray-700 bg-gray-50 px-4 py-3 rounded-[7px] border-l-2 border-gray-200">{t}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sintesi AI */}
        {latestRiassunto?.riassunto_ai && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sintesi AI dei commenti</div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Claude</span>
              </div>
              <div className="text-xs text-gray-400">
                {latestRiassunto.data_somministrazione || latestRiassunto.created_at?.split('T')[0]}
              </div>
            </div>
            <div className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-xl px-5 py-4 leading-relaxed whitespace-pre-wrap">
              {latestRiassunto.riassunto_ai}
            </div>

            {/* Storico accordion */}
            {showStorico && storicoRiassunti.length > 1 && (
              <div className="mt-3">
                <button
                  onClick={() => setStoricoOpen(o => !o)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
                    className={`transition-transform ${storicoOpen ? 'rotate-90' : ''}`}>
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {storicoOpen ? 'Nascondi' : `Vedi storico (${storicoRiassunti.length - 1} precedente${storicoRiassunti.length > 2 ? 'i' : ''})`}
                </button>
                {storicoOpen && (
                  <div className="mt-3 space-y-3">
                    {storicoRiassunti.slice(1).map(q => (
                      <div key={q.id}>
                        <div className="text-xs text-gray-400 mb-1">
                          {q.data_somministrazione || q.created_at?.split('T')[0]}
                        </div>
                        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap">
                          {q.riassunto_ai}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!showStorico && latestRiassunto?.riassunto_ai === undefined && null}
      </div>
    </div>
  )
}

// ─── Mini card for formatore dashboard ───────────────────────────────────────

export function QuestionariMiniCard({ questionari, mediaGlobale }: { questionari: QuestionarioRisultato[]; mediaGlobale: number | null }) {
  const agg = computeAggregates(questionari)
  if (agg.totaleRisposte === 0) {
    return (
      <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Le mie valutazioni</div>
        <p className="text-sm text-gray-400">Nessun questionario ricevuto ancora.</p>
      </div>
    )
  }
  const diff = mediaGlobale != null ? agg.mediaGenerale - mediaGlobale : null
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e5e5' }}>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Le mie valutazioni</div>
      <div className="flex items-end gap-3 mb-3">
        <div>
          <span className="text-2xl font-bold text-gray-900">{agg.mediaGenerale.toFixed(1)}</span>
          <span className="text-sm text-gray-400">/5</span>
        </div>
        <StarRating value={agg.mediaGenerale}/>
        <span className="text-xs text-gray-400 mb-0.5">da {agg.totaleRisposte} risposte</span>
      </div>
      {diff != null && (
        <div className="text-xs text-gray-500 mb-3">
          Media Formascuole: <span className="font-medium">{mediaGlobale!.toFixed(1)}</span>
          {diff > 0.05
            ? <span className="ml-1 text-green-600 font-medium">↑ +{diff.toFixed(1)}</span>
            : diff < -0.05
            ? <span className="ml-1 text-red-500 font-medium">↓ {diff.toFixed(1)}</span>
            : <span className="ml-1 text-gray-400">≈ nella media</span>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[['Formatore', agg.mediaFormatore], ['Contenuti', agg.mediaContenuti], ['Apprendimento', agg.mediaApprendimento]].map(([l, v]) => (
          <div key={l as string} className="text-center bg-gray-50 rounded-lg py-2">
            <div className="text-[10px] text-gray-400 mb-0.5">{l}</div>
            <div className="text-sm font-bold text-gray-800">{(v as number).toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClipboardIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="text-gray-400">
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
