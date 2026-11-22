'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type {
  RisultatoProgetto,
  CorsoCalcolato,
  VerificaRisultato,
  SemaforoStato,
} from '@/lib/dm219/calcoli'

interface ApiResponse extends RisultatoProgetto {
  progetto: { id: string; school_name: string; status: string; finanziamento_id: string }
  params_override: {
    tutor_riconosciuto: boolean
    base_quota_lab: 'realizzato' | 'accordato'
    corsi_inclusi: string[]
    corsi_esclusi: string[]
    data_fine_effettiva: string
  } | null
}

const SEMAFORO_LABEL: Record<SemaforoStato, string> = {
  VERDE:    '✓ Raggiunto',
  GIALLO:   '~ In linea',
  ARANCIONE:'⚠ A rischio',
  ROSSO:    '✗ Non raggiungibile',
}
const SEMAFORO_BADGE: Record<SemaforoStato, string> = {
  VERDE:    'bg-green-100 text-green-800 border-green-200',
  GIALLO:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  ARANCIONE:'bg-orange-100 text-orange-700 border-orange-200',
  ROSSO:    'bg-red-100 text-red-700 border-red-200',
}

function euro(n: number) {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

function BarraAvanzamento({
  valore, max, soglia = 0.70, label,
}: { valore: number; max: number; soglia?: number; label?: string }) {
  const pctVal = max > 0 ? Math.min(valore / max, 1) : 0
  const sogliaPct = soglia * 100
  const colore = pctVal >= soglia ? 'bg-green-500' : pctVal >= soglia * 0.6 ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{label}</span>
          <span className="font-mono">{(pctVal * 100).toFixed(1)}%</span>
        </div>
      )}
      <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-visible">
        <div
          className={`h-full rounded-full transition-all ${colore}`}
          style={{ width: `${Math.min(pctVal * 100, 100)}%` }}
        />
        {/* tacca soglia */}
        <div
          className="absolute top-[-4px] w-0.5 h-[20px] bg-gray-500 rounded-full"
          style={{ left: `${Math.min(sogliaPct, 100)}%` }}
          title={`Soglia: ${sogliaPct}%`}
        />
        <div
          className="absolute -top-5 text-[10px] text-gray-500 -translate-x-1/2"
          style={{ left: `${Math.min(sogliaPct, 100)}%` }}
        >
          {sogliaPct}%
        </div>
      </div>
    </div>
  )
}

function TabellaAggregati({ data }: { data: ApiResponse }) {
  const rows = [
    { label: 'Ore previste',    pf: data.pf.ore_previste,    lab: data.lab.ore_previste,    tot: data.totale.ore_previste,    unit: 'h' },
    { label: 'Ore erogate',     pf: data.pf.ore_erogate,     lab: data.lab.ore_erogate,     tot: data.totale.ore_erogate,     unit: 'h' },
    { label: 'Ore residue',     pf: data.pf.ore_residue,     lab: data.lab.ore_residue,     tot: data.totale.ore_residue,     unit: 'h' },
    { label: 'Valore previsto', pf: data.pf.valore_previsto, lab: data.lab.valore_previsto, tot: data.totale.valore_previsto, unit: '€' },
    { label: 'Valore erogato',  pf: data.pf.valore_erogato,  lab: data.lab.valore_erogato,  tot: data.totale.valore_erogato,  unit: '€' },
    { label: 'Valore residuo',  pf: data.pf.valore_residuo,  lab: data.lab.valore_residuo,  tot: data.totale.valore_residuo,  unit: '€' },
  ]
  function fmt(v: number, u: string) {
    return u === '€' ? euro(v) : `${v}h`
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
            <th className="text-left py-2 font-medium">Voce</th>
            <th className="text-right py-2 font-medium px-3">PF</th>
            <th className="text-right py-2 font-medium px-3">Lab</th>
            <th className="text-right py-2 font-medium px-3">Totale</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(r => (
            <tr key={r.label}>
              <td className="py-2 text-gray-700">{r.label}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-900">{fmt(r.pf, r.unit)}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-900">{fmt(r.lab, r.unit)}</td>
              <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">{fmt(r.tot, r.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabellaVerifiche({ verifiche }: { verifiche: VerificaRisultato[] }) {
  return (
    <div className="space-y-2">
      {verifiche.map(v => (
        <div
          key={v.label}
          className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
            v.ok ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
          }`}
        >
          <span className={`mt-0.5 flex-shrink-0 ${v.ok ? 'text-green-500' : 'text-red-400'}`}>
            {v.ok
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            }
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">{v.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Soglia: {v.soglia} · Attuale: <span className="font-mono">{v.valore}</span>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            v.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}>
            {v.ok ? 'OK' : 'NON RAGGIUNTO'}
          </span>
        </div>
      ))}
    </div>
  )
}

function TabellaCorsi({
  corsi,
  corsi_inclusi,
  corsi_esclusi,
  onToggle,
  saving,
}: {
  corsi: CorsoCalcolato[]
  corsi_inclusi: string[]
  corsi_esclusi: string[]
  onToggle: (id: string, action: 'forza_includi' | 'forza_escludi' | 'reset') => void
  saving: boolean
}) {
  const statoColor: Record<string, string> = {
    'Da avviare': 'bg-gray-100 text-gray-600',
    'Avviato':    'bg-blue-100 text-blue-700',
    'Concluso':   'bg-green-100 text-green-700',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
            <th className="text-left py-2 font-medium">Tipo</th>
            <th className="text-left py-2 font-medium px-2">Stato</th>
            <th className="text-right py-2 font-medium px-2">Ore</th>
            <th className="text-right py-2 font-medium px-2">Erogate</th>
            <th className="text-right py-2 font-medium px-2">Valore prev.</th>
            <th className="text-center py-2 font-medium px-2">Scenario</th>
            <th className="text-left py-2 font-medium px-2">Segnalazioni</th>
            <th className="text-center py-2 font-medium px-2">Forza</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {corsi.map((c, i) => {
            const forzaIncluso = corsi_inclusi.includes(c.id)
            const forzaEscluso = corsi_esclusi.includes(c.id)
            const pctErogata = c.ore_totali > 0 ? c.ore_erogate / c.ore_totali : 0

            return (
              <tr key={c.id} className={`transition ${c.nello_scenario ? 'bg-blue-50/40' : ''}`}>
                <td className="py-2 font-medium text-gray-900">{c.tipo}</td>
                <td className="py-2 px-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statoColor[c.stato] ?? ''}`}>
                    {c.stato}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <div>{c.ore_totali}h</div>
                  <div className="mt-0.5 w-16 ml-auto">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pctErogata >= 1 ? 'bg-green-500' : 'bg-blue-400'}`}
                        style={{ width: `${Math.min(pctErogata * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono">{c.ore_erogate}h</td>
                <td className="py-2 px-2 text-right font-mono text-xs">{euro(c.valore_previsto)}</td>
                <td className="py-2 px-2 text-center">
                  {c.nello_scenario
                    ? <span title="Incluso nello scenario">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mx-auto text-blue-500">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    : <span className="text-gray-200">—</span>
                  }
                  {forzaIncluso && <span className="text-[10px] text-blue-600 block">forzato ✓</span>}
                  {forzaEscluso && <span className="text-[10px] text-red-500 block">escluso</span>}
                </td>
                <td className="py-2 px-2">
                  {c.segnalazioni.length > 0
                    ? <ul className="space-y-0.5">
                        {c.segnalazioni.map((s, j) => (
                          <li key={j} className="text-xs text-orange-600 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                              <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
                            </svg>
                            {s}
                          </li>
                        ))}
                      </ul>
                    : <span className="text-gray-300 text-xs">—</span>
                  }
                </td>
                <td className="py-2 px-2 text-center">
                  {c.stato === 'Da avviare' && (
                    <div className="flex gap-1 justify-center">
                      {!forzaIncluso && (
                        <button
                          disabled={saving}
                          onClick={() => onToggle(c.id, 'forza_includi')}
                          title="Forza inclusione nello scenario"
                          className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
                        >
                          ✓ Includi
                        </button>
                      )}
                      {!forzaEscluso && (
                        <button
                          disabled={saving}
                          onClick={() => onToggle(c.id, 'forza_escludi')}
                          title="Escludi dallo scenario"
                          className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          ✗ Escludi
                        </button>
                      )}
                      {(forzaIncluso || forzaEscluso) && (
                        <button
                          disabled={saving}
                          onClick={() => onToggle(c.id, 'reset')}
                          className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition disabled:opacity-50"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Dm219DetailClient({ progettoId }: { progettoId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/dm219/${progettoId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d as ApiResponse)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [progettoId])

  useEffect(() => { load() }, [load])

  async function handleToggle(corsoId: string, action: 'forza_includi' | 'forza_escludi' | 'reset') {
    if (!data) return
    const inclusi = [...(data.params_override?.corsi_inclusi ?? [])]
    const esclusi = [...(data.params_override?.corsi_esclusi ?? [])]

    if (action === 'forza_includi') {
      if (!inclusi.includes(corsoId)) inclusi.push(corsoId)
      const idx = esclusi.indexOf(corsoId)
      if (idx >= 0) esclusi.splice(idx, 1)
    } else if (action === 'forza_escludi') {
      if (!esclusi.includes(corsoId)) esclusi.push(corsoId)
      const idx = inclusi.indexOf(corsoId)
      if (idx >= 0) inclusi.splice(idx, 1)
    } else {
      const ii = inclusi.indexOf(corsoId)
      if (ii >= 0) inclusi.splice(ii, 1)
      const ei = esclusi.indexOf(corsoId)
      if (ei >= 0) esclusi.splice(ei, 1)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/dm219/${progettoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corsi_inclusi: inclusi, corsi_esclusi: esclusi }),
      })
      const json = await res.json()
      if (!res.ok) setError(json?.error ?? 'Errore salvataggio')
      else load()
    } finally {
      setSaving(false)
    }
  }

  async function handleParamChange(key: 'tutor_riconosciuto' | 'base_quota_lab' | 'data_fine_effettiva', value: boolean | string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/dm219/${progettoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      const json = await res.json()
      if (!res.ok) setError(json?.error ?? 'Errore salvataggio')
      else load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <svg className="animate-spin mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Caricamento…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {error ?? 'Dati non disponibili'}
        </div>
      </div>
    )
  }

  const paramsOvr = data.params_override
  const tutorRiconosciuto = paramsOvr?.tutor_riconosciuto ?? true
  const baseQuotaLab = paramsOvr?.base_quota_lab ?? 'realizzato'
  const dataFineEffettiva = paramsOvr?.data_fine_effettiva ?? '2026-12-20'
  const corsiInclusi = paramsOvr?.corsi_inclusi ?? []
  const corsiEsclusi = paramsOvr?.corsi_esclusi ?? []

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dm219" className="mt-1 text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">{data.progetto.school_name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full border ${SEMAFORO_BADGE[data.semaforo]}`}>
              {SEMAFORO_LABEL[data.semaforo]}
            </span>
            {!data.scenario.valido && (
              <span className="text-sm text-red-600">{data.scenario.motivo_non_valido}</span>
            )}
          </div>
        </div>
        {/* Parametri override */}
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tutorRiconosciuto}
              disabled={saving}
              onChange={e => handleParamChange('tutor_riconosciuto', e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-600">Tutor riconosciuto</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Base quota Lab:</span>
            <select
              value={baseQuotaLab}
              disabled={saving}
              onChange={e => handleParamChange('base_quota_lab', e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
            >
              <option value="realizzato">Realizzato</option>
              <option value="accordato">Accordato</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Fine effettiva:</span>
            <input
              type="date"
              value={dataFineEffettiva}
              disabled={saving}
              onChange={e => handleParamChange('data_fine_effettiva', e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
              title="Data entro cui contare le sessioni pianificate (es. chiusura pre-natale)"
            />
          </div>
        </div>
      </div>

      {/* Barre avanzamento */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Avanzamento</h2>
        <div className="space-y-6">
          <div>
            <BarraAvanzamento
              valore={data.totale.ore_erogate}
              max={data.totale.ore_previste}
              label={`Ore erogate (${data.totale.ore_erogate}h / ${data.totale.ore_previste}h)`}
            />
          </div>
          <div>
            <BarraAvanzamento
              valore={data.totale.valore_erogato}
              max={data.finanziamento_accordato}
              label={`Valore erogato (${euro(data.totale.valore_erogato)} / ${euro(data.finanziamento_accordato)} — importo ricostruito)`}
            />
          </div>
        </div>
        <div className="pt-1 text-xs text-gray-400">
          Soglie: ore ≥ {data.soglia_ore}h · valore ≥ {euro(data.soglia_valore)} · La tacca verticale indica il 70%
        </div>
      </div>

      {/* Aggregati */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Aggregati per tipo</h2>
        <TabellaAggregati data={data} />
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
          {(['pf', 'lab', 'totale'] as const).map(k => (
            <div key={k} className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k === 'totale' ? 'Totale' : k.toUpperCase()}</div>
              <div className="text-sm">
                <span className="font-medium">{data[k].n_conclusi}</span> conclusi ·
                <span className="font-medium"> {data[k].n_avviati}</span> avviati ·
                <span className="font-medium"> {data[k].n_da_avviare}</span> da avviare
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scenario minimo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Scenario minimo</h2>
        {!data.scenario.valido ? (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
            {data.scenario.motivo_non_valido ?? 'Nessuno scenario valido trovato'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Ancora da erogare</div>
              <div className="rounded-lg bg-gray-50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Completamento PF</span>
                  <span className="font-mono font-semibold">{data.scenario.ore_completamento_pf}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nuovi corsi PF</span>
                  <span className="font-mono font-semibold">{data.scenario.ore_nuovi_pf}h</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-700 font-medium">Totale PF mancante</span>
                  <span className="font-mono font-bold">{data.ore_mancanti_pf}h</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-gray-600">Completamento Lab</span>
                  <span className="font-mono font-semibold">{data.scenario.ore_completamento_lab}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nuovi corsi Lab</span>
                  <span className="font-mono font-semibold">{data.scenario.ore_nuovi_lab}h</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-700 font-medium">Totale Lab mancante</span>
                  <span className="font-mono font-bold">{data.ore_mancanti_lab}h</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Riepilogo scenario</div>
              <div className="rounded-lg bg-gray-50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ore totali scenario</span>
                  <span className="font-mono font-semibold">{data.scenario.ore_totali}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valore scenario</span>
                  <span className="font-mono font-semibold">{euro(data.scenario.valore_totale)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quota Lab</span>
                  <span className={`font-mono font-semibold ${data.scenario.quota_lab_pct >= 0.5 ? 'text-green-600' : 'text-red-500'}`}>
                    {pct(data.scenario.quota_lab_pct)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-600">Ore rinunciabili</span>
                  <span className="font-mono">{data.scenario.ore_rinunciabili}h</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Verifiche */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Verifiche</h2>
        <TabellaVerifiche verifiche={data.verifiche} />
      </div>

      {/* Corsi */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Corsi</h2>
          <div className="text-xs text-gray-400">
            Sfondo blu = incluso nello scenario · Puoi forzare inclusione/esclusione dei corsi &quot;Da avviare&quot;
          </div>
        </div>
        <TabellaCorsi
          corsi={data.corsi}
          corsi_inclusi={corsiInclusi}
          corsi_esclusi={corsiEsclusi}
          onToggle={handleToggle}
          saving={saving}
        />
        {data.n_segnalazioni > 0 && (
          <div className="mt-3 text-sm text-orange-600 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {data.n_segnalazioni} segnalazion{data.n_segnalazioni > 1 ? 'i' : 'e'} attiv{data.n_segnalazioni > 1 ? 'e' : 'a'} — risolvile per migliorare l&apos;affidabilità dello scenario
          </div>
        )}
      </div>
    </div>
  )
}
