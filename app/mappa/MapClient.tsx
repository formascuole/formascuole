'use client'
import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { ProgettoConStats, Profile, Finanziamento } from '@/lib/types'
import type { LeafletMapProps } from './LeafletMap'

const LeafletMap = dynamic<LeafletMapProps>(
  () => import('./LeafletMap').then(m => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400 text-sm">
        Caricamento mappa…
      </div>
    ),
  }
)

interface MapClientProps {
  progetti: ProgettoConStats[]
  formatori: Profile[]
  finanziamenti: Finanziamento[]
  corsiPerFormatore: Record<string, number>
  isSuperAdmin: boolean
  nProgettiSenzaCoord: number
  nFormatoriSenzaCoord: number
}

interface GeoProgress {
  processed: number
  total: number
  item: string
  running: boolean
  done: boolean
  error: string | null
}

export function MapClient({
  progetti,
  formatori,
  finanziamenti,
  corsiPerFormatore,
  isSuperAdmin,
  nProgettiSenzaCoord,
  nFormatoriSenzaCoord,
}: MapClientProps) {
  const router = useRouter()
  const [showScuole, setShowScuole] = useState(true)
  const [showFormatori, setShowFormatori] = useState(true)
  const [finanziamentoFilter, setFinanziamentoFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [geoProgress, setGeoProgress] = useState<GeoProgress | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const startGeocode = useCallback(async () => {
    abortRef.current = new AbortController()
    setGeoProgress({ processed: 0, total: 0, item: '', running: true, done: false, error: null })

    try {
      const res = await fetch('/api/mappa/geocode', {
        method: 'POST',
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        setGeoProgress(p => p ? { ...p, running: false, error: `Errore ${res.status}` } : p)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'start') {
              setGeoProgress(p => p ? {
                ...p,
                total: (msg.totalProjects ?? 0) + (msg.totalFormatori ?? 0),
              } : p)
            } else if (msg.type === 'progress') {
              setGeoProgress(p => p ? {
                ...p,
                processed: msg.processed,
                total: msg.total,
                item: msg.item,
              } : p)
            } else if (msg.type === 'complete') {
              setGeoProgress(p => p ? { ...p, running: false, done: true } : p)
              router.refresh()
            } else if (msg.type === 'error') {
              setGeoProgress(p => p ? { ...p, running: false, error: msg.message } : p)
            }
          } catch {
            // malformed line, skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGeoProgress(p => p ? { ...p, running: false, error: String(err) } : p)
      }
    }
  }, [router])

  const stopGeocode = useCallback(() => {
    abortRef.current?.abort()
    setGeoProgress(p => p ? { ...p, running: false } : p)
  }, [])

  const totalSenzaCoord = nProgettiSenzaCoord + nFormatoriSenzaCoord
  const pct = geoProgress && geoProgress.total > 0
    ? Math.round((geoProgress.processed / geoProgress.total) * 100)
    : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <h1 className="text-sm font-semibold text-gray-800 mr-2">Mappa</h1>

        {/* Geocoding button (super_admin only) */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {geoProgress?.running ? (
              <>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="animate-spin w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span className="max-w-[200px] truncate">{geoProgress.item}</span>
                  <span className="font-medium">{geoProgress.processed}/{geoProgress.total} ({pct}%)</span>
                </div>
                <button
                  onClick={stopGeocode}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Interrompi
                </button>
              </>
            ) : geoProgress?.done ? (
              <span className="text-xs text-green-600 font-medium">
                ✓ Geocodifica completata
              </span>
            ) : geoProgress?.error ? (
              <span className="text-xs text-red-600">Errore: {geoProgress.error}</span>
            ) : totalSenzaCoord > 0 ? (
              <button
                onClick={startGeocode}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium border border-blue-200"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Geocodifica indirizzi
                <span className="ml-1 bg-blue-200 text-blue-800 rounded-full px-1.5 text-[10px]">
                  {totalSenzaCoord}
                </span>
              </button>
            ) : (
              <span className="text-xs text-gray-400">Tutti i pin sono geolocalizzati</span>
            )}
          </div>
        )}
      </div>

      {/* Map area with overlaid filter panel */}
      <div className="relative flex-1" style={{ minHeight: 0 }}>
        <LeafletMap
          progetti={progetti}
          formatori={formatori}
          finanziamenti={finanziamenti}
          corsiPerFormatore={corsiPerFormatore}
          showScuole={showScuole}
          showFormatori={showFormatori}
          finanziamentoFilter={finanziamentoFilter}
          statusFilter={statusFilter}
        />

        {/* Filter panel (floating left) */}
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2" style={{ maxWidth: 220 }}>
          <div className="bg-white rounded-xl shadow-lg border border-gray-100" style={{ overflow: 'hidden' }}>
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setFiltersOpen(o => !o)}
            >
              <span className="flex items-center gap-1.5">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Filtri
              </span>
              <svg
                width="12" height="12" fill="none" viewBox="0 0 24 24"
                style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {filtersOpen && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-2.5">
                {/* Toggle switches */}
                <label className="flex items-center justify-between cursor-pointer gap-2">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#22c55e' }}/>
                    Scuole
                  </span>
                  <input
                    type="checkbox"
                    checked={showScuole}
                    onChange={e => setShowScuole(e.target.checked)}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer gap-2">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f97316' }}/>
                    Formatori
                  </span>
                  <input
                    type="checkbox"
                    checked={showFormatori}
                    onChange={e => setShowFormatori(e.target.checked)}
                    className="rounded"
                  />
                </label>

                {/* Finanziamento filter */}
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Finanziamento</label>
                  <select
                    value={finanziamentoFilter}
                    onChange={e => setFinanziamentoFilter(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="">Tutti</option>
                    {finanziamenti.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Stato progetto</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="">Tutti</option>
                    <option value="active">Attivo</option>
                    <option value="pending">In attesa</option>
                    <option value="completed">Concluso</option>
                  </select>
                </div>

                {(finanziamentoFilter || statusFilter) && (
                  <button
                    onClick={() => { setFinanziamentoFilter(''); setStatusFilter('') }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Rimuovi filtri
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2.5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Legenda</div>
            <div className="space-y-1">
              {[
                { color: '#22c55e', label: 'Progetto attivo' },
                { color: '#eab308', label: 'Progetto in attesa' },
                { color: '#6b7280', label: 'Progetto concluso' },
                { color: '#f97316', label: 'Formatore' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <svg width="10" height="14" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
                      fill={color} stroke="white" strokeWidth="2"/>
                  </svg>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Counts overlay bottom-right */}
        <div className="absolute bottom-6 right-3 z-[1000]">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs text-gray-500 flex gap-3">
            <span>
              <strong className="text-gray-800">
                {progetti.filter(p => p.lat && p.lng).length}
              </strong> scuole
            </span>
            <span>
              <strong className="text-gray-800">
                {formatori.filter(f => f.lat && f.lng).length}
              </strong> formatori
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
