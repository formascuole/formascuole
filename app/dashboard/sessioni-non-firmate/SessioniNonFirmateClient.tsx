'use client'
import Link from 'next/link'

export type SessioneItem = {
  id: string
  data: string
  ora_inizio: string | null
  ore: number
}

export type CorsoConSessioni = {
  corso_id: string
  corso_title: string
  formatore: string | null
  formatore_email: string | null
  sessioni: SessioneItem[]
}

export type ScuolaConSessioni = {
  school_name: string
  anno_scolastico: string | null
  corsi: CorsoConSessioni[]
}

interface Props {
  scuole: ScuolaConSessioni[]
  totaleSessioni: number
  dataRiferimento: string
}

function formatData(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  return `${giorni[dt.getDay()]} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

function formatOra(t: string | null) {
  if (!t) return '—'
  return t.slice(0, 5)
}

export function SessioniNonFirmateClient({ scuole, totaleSessioni, dataRiferimento }: Props) {
  const totaleCorsi = scuole.reduce((s, sc) => s + sc.corsi.length, 0)
  const totaleScuole = scuole.length
  const totaleOre = scuole.reduce((s, sc) => s + sc.corsi.reduce((s2, c) => s2 + c.sessioni.reduce((s3, se) => s3 + Number(se.ore), 0), 0), 0)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Dashboard</Link>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="text-gray-300"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-sm text-gray-600">Sessioni non firmate</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sessioni non firmate</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sessioni con data antecedente al {new Date(dataRiferimento + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} ancora da confermare come erogate
          </p>
        </div>
        <a
          href="/api/export/sessioni-non-firmate"
          download
          className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 border border-green-200 px-4 py-2 rounded-[9px] transition-colors shrink-0"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path d="M12 3v13m0 0l-4-4m4 4l4-4M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Esporta Excel
        </a>
      </div>

      {/* Riepilogo badge */}
      {totaleSessioni > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-800 text-sm font-medium px-3 py-1.5 rounded-lg">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/></svg>
            {totaleSessioni} session{totaleSessioni === 1 ? 'e' : 'i'} · <strong>{totaleOre}h</strong> non firmate
          </div>
          <span className="text-sm text-gray-400">{totaleCorsi} cors{totaleCorsi === 1 ? 'o' : 'i'} · {totaleScuole} scuol{totaleScuole === 1 ? 'a' : 'e'}</span>
        </div>
      )}

      {totaleSessioni === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-8 py-16 text-center">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" className="mx-auto mb-3 text-green-400">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-gray-600 font-medium">Nessuna sessione non firmata</p>
          <p className="text-sm text-gray-400 mt-1">Tutte le sessioni passate risultano correttamente firmate.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scuole.map(scuola => (
            <div key={scuola.school_name} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Header scuola */}
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" className="text-gray-400 shrink-0">
                    <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="font-semibold text-gray-800 text-sm">{scuola.school_name}</span>
                  {scuola.anno_scolastico && (
                    <span className="text-xs text-gray-400">· {scuola.anno_scolastico}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {scuola.corsi.reduce((s, c) => s + c.sessioni.length, 0)} session{scuola.corsi.reduce((s, c) => s + c.sessioni.length, 0) === 1 ? 'e' : 'i'}
                </span>
              </div>

              {/* Corsi */}
              <div className="divide-y divide-gray-50">
                {scuola.corsi.map(corso => (
                  <div key={corso.corso_id} className="px-5 py-4">
                    {/* Header corso */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{corso.corso_title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="text-gray-400">
                            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          {corso.formatore ? (
                            <span className="text-xs text-gray-500">
                              {corso.formatore}
                              {corso.formatore_email && (
                                <span className="text-gray-400"> · {corso.formatore_email}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-red-500">Formatore non assegnato</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-md shrink-0">
                        {corso.sessioni.length} da firmare
                      </span>
                    </div>

                    {/* Sessioni */}
                    <div className="rounded-lg overflow-hidden border border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500">
                            <th className="text-left font-medium px-3 py-2">Data</th>
                            <th className="text-left font-medium px-3 py-2">Orario</th>
                            <th className="text-right font-medium px-3 py-2">Ore</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {corso.sessioni.map((s, idx) => (
                            <tr key={s.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                              <td className="px-3 py-2 text-gray-700">{formatData(s.data)}</td>
                              <td className="px-3 py-2 text-gray-500">{formatOra(s.ora_inizio)}</td>
                              <td className="px-3 py-2 text-gray-700 text-right font-medium">{s.ore}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
