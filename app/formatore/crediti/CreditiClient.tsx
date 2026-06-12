'use client'
import type { CreditoItem } from './page'

interface Props {
  items: CreditoItem[]
  regime: 'forfettario' | 'ordinario'
  rivalsaIva: boolean
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export function CreditiClient({ items, regime, rivalsaIva }: Props) {
  const showIva = regime === 'ordinario' && rivalsaIva

  const totImponibile = items.reduce((s, i) => s + i.imponibile, 0)
  const totIva = items.reduce((s, i) => s + i.iva, 0)
  const totNetto = items.reduce((s, i) => s + i.netto, 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">I miei crediti</h1>
        <p className="text-sm text-gray-500 mt-1">Corsi completati da fatturare a SVC Consulting Srl</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl px-6 py-16 text-center text-sm text-gray-400" style={{ border: '0.5px solid #e5e5e5' }}>
          Nessun corso completato da fatturare.
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden mb-6" style={{ border: '0.5px solid #e5e5e5' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">CORSO</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">SCUOLA</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">PERIODO</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">ORE</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">TARIFFA</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IMPONIBILE</th>
                {showIva && <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">IVA 22%</th>}
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">TOTALE</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">STATO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.corso_id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{item.title}</td>
                  <td className="px-4 py-3 text-gray-500">{item.school_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {item.prima_sessione === item.ultima_sessione
                      ? fmtDate(item.prima_sessione)
                      : `${fmtDate(item.prima_sessione)} – ${fmtDate(item.ultima_sessione)}`}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{item.ore_erogate}h</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {item.tariffa != null ? `€ ${item.tariffa.toFixed(2)}/h` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">€ {item.imponibile.toFixed(2)}</td>
                  {showIva && (
                    <td className="px-4 py-3 text-right font-mono text-blue-600">€ {item.iva.toFixed(2)}</td>
                  )}
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">€ {item.netto.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {item.fattura_ricevuta ? (
                      <div>
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                          Fattura ricevuta
                        </span>
                        {item.fattura_ricevuta_at && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(item.fattura_ricevuta_at).toLocaleDateString('it-IT')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-orange-100 text-orange-700">
                        Da fatturare
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Totale</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">€ {totImponibile.toFixed(2)}</td>
                {showIva && (
                  <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">€ {totIva.toFixed(2)}</td>
                )}
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">€ {totNetto.toFixed(2)}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* SVC info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <div className="text-sm font-semibold text-blue-900 mb-2">Istruzioni per il pagamento</div>
        <p className="text-sm text-blue-700 mb-2">Per il pagamento emetti fattura elettronica a:</p>
        <div className="font-medium text-blue-900 text-sm space-y-0.5">
          <div>SVC Consulting Srl</div>
          <div className="text-blue-600">Via Antonio Vallisneri 7, 00197 Roma</div>
          <div className="text-blue-600">CF/PI: 07142321004</div>
        </div>
      </div>
    </div>
  )
}
