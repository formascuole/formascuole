'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type SemaforoStato = 'VERDE' | 'GIALLO' | 'ARANCIONE' | 'ROSSO'

interface ProgettoRiga {
  progetto_id: string
  school_name: string
  status: string
  semaforo: SemaforoStato
  pct_ore: number
  pct_valore: number
  ore_previste: number
  ore_erogate: number
  ore_mancanti_pf: number
  ore_mancanti_lab: number
  quota_lab_pct: number
  n_segnalazioni: number
  scenario_valido: boolean
}

const SEMAFORO_LABEL: Record<SemaforoStato, string> = {
  VERDE:    'Raggiunto',
  GIALLO:   'In linea',
  ARANCIONE:'A rischio',
  ROSSO:    'Non raggiungibile',
}

const SEMAFORO_COLOR: Record<SemaforoStato, string> = {
  VERDE:    'bg-green-100 text-green-800',
  GIALLO:   'bg-yellow-100 text-yellow-800',
  ARANCIONE:'bg-orange-100 text-orange-700',
  ROSSO:    'bg-red-100 text-red-700',
}

const SEMAFORO_DOT: Record<SemaforoStato, string> = {
  VERDE:    'bg-green-500',
  GIALLO:   'bg-yellow-400',
  ARANCIONE:'bg-orange-500',
  ROSSO:    'bg-red-500',
}

type FiltroStato = 'tutti' | SemaforoStato

function BarraAvanzamento({ pct, soglia = 0.70 }: { pct: number; soglia?: number }) {
  const pctPct = Math.min(pct * 100, 100)
  const sogliaPct = soglia * 100
  const colore = pct >= soglia ? 'bg-green-500' : pct >= soglia * 0.7 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-visible">
      <div
        className={`h-full rounded-full transition-all ${colore}`}
        style={{ width: `${pctPct}%` }}
      />
      {/* tacca soglia */}
      <div
        className="absolute top-[-3px] w-0.5 h-[14px] bg-gray-500 rounded"
        style={{ left: `${sogliaPct}%` }}
      />
    </div>
  )
}

type SortKey = keyof ProgettoRiga

export function Dm219ListClient() {
  const [righe, setRighe] = useState<ProgettoRiga[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroStato>('tutti')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'semaforo', dir: 'asc',
  })

  useEffect(() => {
    setLoading(true)
    fetch('/api/dm219')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setRighe(data)
        else setError(data?.error ?? 'Errore sconosciuto')
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const ordineStato: Record<SemaforoStato, number> = {
    ROSSO: 0, ARANCIONE: 1, GIALLO: 2, VERDE: 3
  }

  const righeFiltered = righe
    .filter(r => filtro === 'tutti' || r.semaforo === filtro)
    .sort((a, b) => {
      const av = sort.key === 'semaforo'
        ? ordineStato[a.semaforo]
        : (a[sort.key] as number | string)
      const bv = sort.key === 'semaforo'
        ? ordineStato[b.semaforo]
        : (b[sort.key] as number | string)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-gray-600 ml-1">{sort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  const conteggioPerStato = {
    VERDE:    righe.filter(r => r.semaforo === 'VERDE').length,
    GIALLO:   righe.filter(r => r.semaforo === 'GIALLO').length,
    ARANCIONE:righe.filter(r => r.semaforo === 'ARANCIONE').length,
    ROSSO:    righe.filter(r => r.semaforo === 'ROSSO').length,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Monitoraggio DM 219/2025</h1>
        <p className="text-sm text-gray-500 mt-1">
          Soglia minima: 70% delle ore e del valore finanziato · Quota Lab ≥ 50%
        </p>
      </div>

      {/* KPI bar */}
      {!loading && righe.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {(['VERDE', 'GIALLO', 'ARANCIONE', 'ROSSO'] as SemaforoStato[]).map(s => (
            <button
              key={s}
              onClick={() => setFiltro(f => f === s ? 'tutti' : s)}
              className={`rounded-xl p-3 text-left transition border ${
                filtro === s ? 'ring-2 ring-offset-1 ring-gray-400' : ''
              } ${SEMAFORO_COLOR[s]} border-transparent`}
            >
              <div className="text-2xl font-bold">{conteggioPerStato[s]}</div>
              <div className="text-xs font-medium mt-0.5">{SEMAFORO_LABEL[s]}</div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <svg className="animate-spin mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Caricamento…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {error}
        </div>
      )}

      {!loading && !error && righe.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          Nessun progetto DM 219/2025 trovato. Verifica che esista un finanziamento con "219" nel nome.
        </div>
      )}

      {!loading && !error && righe.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none w-8">
                  <button onClick={() => toggleSort('semaforo')} className="flex items-center">
                    <SortIcon col="semaforo" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('school_name')}>
                  Scuola <SortIcon col="school_name" />
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('pct_ore')}>
                  % Ore <SortIcon col="pct_ore" />
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('pct_valore')}>
                  % Valore <SortIcon col="pct_valore" />
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('ore_mancanti_pf')}>
                  Mancano PF <SortIcon col="ore_mancanti_pf" />
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('ore_mancanti_lab')}>
                  Mancano Lab <SortIcon col="ore_mancanti_lab" />
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('quota_lab_pct')}>
                  Quota Lab <SortIcon col="quota_lab_pct" />
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('n_segnalazioni')}>
                  Segnalazioni <SortIcon col="n_segnalazioni" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {righeFiltered.map(r => (
                <tr key={r.progetto_id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className={`w-3 h-3 rounded-full ${SEMAFORO_DOT[r.semaforo]}`} title={SEMAFORO_LABEL[r.semaforo]} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dm219/${r.progetto_id}`}
                      className="font-medium text-gray-900 hover:text-[#d64b55] transition"
                    >
                      {r.school_name}
                    </Link>
                    <div className="mt-1.5 flex gap-2 items-center">
                      <div className="flex-1">
                        <BarraAvanzamento pct={r.pct_ore} />
                      </div>
                    </div>
                    <div className="mt-0.5 flex gap-2 items-center">
                      <div className="flex-1">
                        <BarraAvanzamento pct={r.pct_valore} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    <span className={r.pct_ore >= 0.70 ? 'text-green-600' : 'text-gray-900'}>
                      {(r.pct_ore * 100).toFixed(0)}%
                    </span>
                    <div className="text-xs text-gray-400">{r.ore_erogate}/{r.ore_previste}h</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    <span className={r.pct_valore >= 0.70 ? 'text-green-600' : 'text-gray-900'}>
                      {(r.pct_valore * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {r.ore_mancanti_pf > 0
                      ? <span className="text-orange-600 font-medium">{r.ore_mancanti_pf}h</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-right">
                    {r.ore_mancanti_lab > 0
                      ? <span className="text-orange-600 font-medium">{r.ore_mancanti_lab}h</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    <span className={r.quota_lab_pct >= 0.50 ? 'text-green-600' : 'text-red-500'}>
                      {(r.quota_lab_pct * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {r.n_segnalazioni > 0
                      ? (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 rounded-full px-2 py-0.5 text-xs font-medium">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          {r.n_segnalazioni}
                        </span>
                      )
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtro !== 'tutti' && (
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
              Filtro: <strong>{SEMAFORO_LABEL[filtro]}</strong> ({righeFiltered.length} progetti)
              <button onClick={() => setFiltro('tutti')} className="ml-2 text-[#d64b55] hover:underline">
                Mostra tutti
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
