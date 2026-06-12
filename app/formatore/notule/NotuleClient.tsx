'use client'
import { useState, useMemo } from 'react'
import type { Notula } from '@/lib/types'
import { calcFinancials, REGIME_LABELS, type RegimeFiscale } from '@/lib/economia-utils'

interface CorsoDaFatturare {
  id: string
  title: string
  project_id: string
  school_name: string
  ore_erogate: number
  tariffa_oraria: number | null
}

interface Props {
  corsiFatturabili: CorsoDaFatturare[]
  notule: Notula[]
  formatoreId: string
  regimeFiscale: RegimeFiscale
  rivalsaIva: boolean
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

export function NotuleClient({ corsiFatturabili, notule: initialNotule, formatoreId, regimeFiscale, rivalsaIva }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [numero, setNumero] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notule, setNotule] = useState<Notula[]>(initialNotule)
  const [corsiFatturabiliState, setCorsiFatturabiliState] = useState<CorsoDaFatturare[]>(corsiFatturabili)
  const [inviandiIds, setInviandiIds] = useState<Set<string>>(new Set())

  const toggleCorso = (id: string) => {
    const corso = corsiFatturabiliState.find(c => c.id === id)
    if (!corso || corso.tariffa_oraria == null) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCorsi = useMemo(
    () => corsiFatturabiliState.filter(c => selected.has(c.id)),
    [corsiFatturabiliState, selected]
  )

  const totals = useMemo(() => {
    if (selectedCorsi.length === 0) return null
    const importoTotale = selectedCorsi.reduce((sum, c) => sum + c.ore_erogate * (c.tariffa_oraria ?? 0), 0)
    const ritenuta = regimeFiscale === 'notula' ? importoTotale * 0.2 : 0
    const iva = (regimeFiscale === 'ordinario' && rivalsaIva) ? importoTotale * 0.22 : 0
    const netto = regimeFiscale === 'notula'
      ? importoTotale - ritenuta
      : (regimeFiscale === 'ordinario' && rivalsaIva)
        ? importoTotale + iva
        : importoTotale
    return { importoTotale, ritenuta, iva, netto }
  }, [selectedCorsi, regimeFiscale, rivalsaIva])

  const marcaDaBollo = totals && regimeFiscale === 'notula' && totals.importoTotale > 77.47

  const handleGeneraNotula = async () => {
    if (!numero.trim()) { setError('Inserisci il numero ricevuta'); return }
    if (selectedCorsi.length === 0) { setError('Seleziona almeno un corso'); return }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/notule/genera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: numero.trim(),
          corso_ids: selectedCorsi.map(c => c.id),
          formatore_id: formatoreId,
        }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Errore nella generazione'); return }

      // Update state
      const newNotula = j.notula as Notula
      setNotule(prev => [newNotula, ...prev])
      setCorsiFatturabiliState(prev => prev.filter(c => !selected.has(c.id)))
      setSelected(new Set())
      setModalOpen(false)
      setNumero('')
    } catch {
      setError('Errore di rete')
    } finally {
      setGenerating(false)
    }
  }

  const handleInviaNotula = async (notulaId: string) => {
    setInviandiIds(prev => new Set([...prev, notulaId]))
    try {
      const res = await fetch(`/api/notule/${notulaId}/invia`, { method: 'POST' })
      if (res.ok) {
        setNotule(prev => prev.map(n => n.id === notulaId ? { ...n, stato: 'inviata' as const, inviata_at: new Date().toISOString() } : n))
      }
    } finally {
      setInviandiIds(prev => { const next = new Set(prev); next.delete(notulaId); return next })
    }
  }

  const selCls = 'text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55]'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Le mie notule</h1>
        <p className="text-sm text-gray-500 mt-1">Genera e gestisci le tue ricevute di pagamento</p>
      </div>

      {/* SECTION A — Corsi da fatturare */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Corsi da fatturare</h2>

        {corsiFatturabiliState.length === 0 ? (
          <div className="bg-white rounded-xl px-6 py-10 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
            Nessun corso completato in attesa di fatturazione.
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">CORSO</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">SCUOLA</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">TARIFFA</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-5 py-3">IMPORTO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {corsiFatturabiliState.map(c => {
                  const noTariffa = c.tariffa_oraria == null
                  const importo = noTariffa ? 0 : c.ore_erogate * c.tariffa_oraria!
                  const isSelected = selected.has(c.id)
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${noTariffa ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'} ${isSelected ? 'bg-[#fbeced]' : ''}`}
                      onClick={() => toggleCorso(c.id)}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={noTariffa}
                          onChange={() => toggleCorso(c.id)}
                          className="w-4 h-4 accent-[#d64b55] cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                      <td className="px-4 py-3 text-gray-500">{c.school_name}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{c.ore_erogate}h</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {noTariffa ? <span className="text-gray-300">—</span> : `€ ${c.tariffa_oraria!.toFixed(2)}/h`}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-800">
                        {noTariffa ? <span className="text-gray-300">—</span> : `€ ${importo.toFixed(2)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Totals bar */}
            {totals && (
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Imponibile: </span>
                    <span className="font-semibold text-gray-900">€ {totals.importoTotale.toFixed(2)}</span>
                  </div>
                  {regimeFiscale === 'notula' && (
                    <div>
                      <span className="text-gray-500">Ritenuta 20%: </span>
                      <span className="font-semibold text-red-600">- € {totals.ritenuta.toFixed(2)}</span>
                    </div>
                  )}
                  {regimeFiscale === 'ordinario' && rivalsaIva && (
                    <div>
                      <span className="text-gray-500">IVA 22%: </span>
                      <span className="font-semibold text-green-700">+ € {totals.iva.toFixed(2)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">{regimeFiscale === 'notula' ? 'Netto: ' : 'Totale: '}</span>
                    <span className="font-bold text-gray-900">€ {totals.netto.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {marcaDaBollo && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                      Marca da bollo richiesta (importo &gt; € 77,47)
                    </span>
                  )}
                  <button
                    onClick={() => setModalOpen(true)}
                    disabled={selected.size === 0}
                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#d64b55' }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5"/>
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Genera notula ({selected.size})
                  </button>
                </div>
              </div>
            )}
            {!totals && selected.size === 0 && (
              <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex justify-end">
                <button
                  disabled
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[7px] text-white opacity-40 cursor-not-allowed"
                  style={{ backgroundColor: '#d64b55' }}
                >
                  Genera notula
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION B — Notule emesse */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Notule emesse</h2>

        {notule.length === 0 ? (
          <div className="bg-white rounded-xl px-6 py-10 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
            Nessuna notula emessa.
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">N.</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">TIPO</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">CORSI</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IMPORTO</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">NETTO</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">STATO</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">DATA</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {notule.map(n => {
                  const corsiTitles = (n.corsi || [])
                    .map((nc) => (nc as { corso?: { title?: string } }).corso?.title ?? '—')
                    .join(', ')
                  const isInviando = inviandiIds.has(n.id)
                  return (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{n.numero}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${n.tipo === 'cumulativa' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {n.tipo === 'cumulativa' ? 'Cumulativa' : 'Singola'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={corsiTitles}>
                        {corsiTitles || '—'}
                      </td>
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
                          <div className="text-xs text-red-600 mt-1 max-w-[160px] truncate" title={n.motivazione_rifiuto}>
                            {n.motivazione_rifiuto}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(n.created_at).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {n.pdf_url && (
                            <a
                              href={n.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-[7px] transition-colors"
                            >
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5"/>
                                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                              </svg>
                              PDF
                            </a>
                          )}
                          {n.stato === 'bozza' && (
                            <button
                              onClick={() => handleInviaNotula(n.id)}
                              disabled={isInviando}
                              className="inline-flex items-center gap-1 text-xs font-medium text-white px-2.5 py-1.5 rounded-[7px] transition-colors disabled:opacity-50"
                              style={{ backgroundColor: '#d64b55' }}
                            >
                              {isInviando ? '...' : 'Invia'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Genera Notula Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Genera notula</h3>
            <p className="text-sm text-gray-500 mb-4">
              Stai generando una notula per <strong>{selected.size}</strong> corso{selected.size > 1 ? 'i' : ''}.
              {totals && <> Importo totale: <strong>€ {totals.importoTotale.toFixed(2)}</strong> — Netto: <strong>€ {totals.netto.toFixed(2)}</strong></>}
            </p>
            {error && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Numero ricevuta</label>
              <input
                type="text"
                value={numero}
                onChange={e => setNumero(e.target.value)}
                placeholder="Es. 001/2025"
                className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55]"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setModalOpen(false); setError(null) }}
                className="text-sm font-medium px-4 py-2 rounded-[7px] border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleGeneraNotula}
                disabled={generating || !numero.trim()}
                className="text-sm font-medium px-4 py-2 rounded-[7px] text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#d64b55' }}
              >
                {generating ? 'Generazione...' : 'Genera PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
