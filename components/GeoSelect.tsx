import { PROVINCE_BY_REGIONE, COMUNI_BY_PROVINCIA, REGIONI } from '@/lib/geo-data'

interface GeoSelectProps {
  regione: string
  provincia: string
  citta: string
  onRegioneChange: (v: string) => void
  onProvinciaChange: (v: string) => void
  onCittaChange: (v: string) => void
  required?: boolean
  className?: string
}

export function GeoSelect({
  regione,
  provincia,
  citta,
  onRegioneChange,
  onProvinciaChange,
  onCittaChange,
  required,
  className,
}: GeoSelectProps) {
  const province = regione ? (PROVINCE_BY_REGIONE[regione] ?? []) : []
  const comuni = provincia ? (COMUNI_BY_PROVINCIA[provincia] ?? []) : []

  return (
    <div className={`grid grid-cols-1 gap-3 ${className ?? ''}`}>
      {/* Regione */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Regione</label>
        <select
          value={regione}
          onChange={e => {
            onRegioneChange(e.target.value)
            onProvinciaChange('')
            onCittaChange('')
          }}
          required={required}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Seleziona regione...</option>
          {REGIONI.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Provincia */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
        <select
          value={provincia}
          onChange={e => {
            onProvinciaChange(e.target.value)
            onCittaChange('')
          }}
          required={required}
          disabled={!regione}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Seleziona provincia...</option>
          {province.map(p => (
            <option key={p.codice} value={p.codice}>{p.nome} ({p.codice})</option>
          ))}
        </select>
      </div>

      {/* Città */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Città / Comune</label>
        {comuni.length > 0 ? (
          <select
            value={citta}
            onChange={e => onCittaChange(e.target.value)}
            required={required}
            disabled={!provincia}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Seleziona comune...</option>
            {comuni.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={citta}
            onChange={e => onCittaChange(e.target.value)}
            required={required}
            disabled={!provincia}
            placeholder={provincia ? 'Inserisci comune...' : 'Seleziona prima la provincia'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        )}
      </div>
    </div>
  )
}
