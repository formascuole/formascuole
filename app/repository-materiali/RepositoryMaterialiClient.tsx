'use client'

import { useState, useMemo } from 'react'
import { MaterialeItem } from './page'

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  )
}

function IconChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg className={`${className} transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function IconExternalLink({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  )
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v8.25" />
    </svg>
  )
}

export function RepositoryMaterialiClient({ materiali }: { materiali: MaterialeItem[] }) {
  const [filterProgetto, setFilterProgetto] = useState('')
  const [filterFormatore, setFilterFormatore] = useState('')
  const [filterTipo, setFilterTipo] = useState<'' | 'file' | 'link'>('')
  const [search, setSearch] = useState('')
  const [openProgetti, setOpenProgetti] = useState<Set<string>>(new Set())
  const [openCorsi, setOpenCorsi] = useState<Set<string>>(new Set())

  // Opzioni filtri
  const progetti = useMemo(() => {
    const map = new Map<string, string>()
    materiali.forEach(m => { if (m.progetto_id) map.set(m.progetto_id, m.school_name) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [materiali])

  const formatori = useMemo(() => {
    const map = new Map<string, string>()
    materiali.forEach(m => { if (m.formatore_id && m.formatore_nome) map.set(m.formatore_id, m.formatore_nome) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [materiali])

  // Filtraggio
  const filtered = useMemo(() => {
    return materiali.filter(m => {
      if (filterProgetto && m.progetto_id !== filterProgetto) return false
      if (filterFormatore && m.formatore_id !== filterFormatore) return false
      if (filterTipo && m.tipo !== filterTipo) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !m.nome.toLowerCase().includes(q) &&
          !m.corso_title.toLowerCase().includes(q) &&
          !m.school_name.toLowerCase().includes(q) &&
          !(m.formatore_nome ?? '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [materiali, filterProgetto, filterFormatore, filterTipo, search])

  // Raggruppamento per progetto → corso
  const grouped = useMemo(() => {
    const byProgetto = new Map<string, {
      progetto_id: string
      school_name: string
      anno_scolastico: string | null
      corsi: Map<string, {
        corso_id: string
        corso_title: string
        corso_tipo: string | null
        formatore_nome: string | null
        materiali: MaterialeItem[]
      }>
    }>()

    for (const m of filtered) {
      if (!byProgetto.has(m.progetto_id)) {
        byProgetto.set(m.progetto_id, {
          progetto_id: m.progetto_id,
          school_name: m.school_name,
          anno_scolastico: m.anno_scolastico,
          corsi: new Map(),
        })
      }
      const prog = byProgetto.get(m.progetto_id)!
      if (!prog.corsi.has(m.corso_id)) {
        prog.corsi.set(m.corso_id, {
          corso_id: m.corso_id,
          corso_title: m.corso_title,
          corso_tipo: m.corso_tipo,
          formatore_nome: m.formatore_nome,
          materiali: [],
        })
      }
      prog.corsi.get(m.corso_id)!.materiali.push(m)
    }

    return [...byProgetto.values()].sort((a, b) => a.school_name.localeCompare(b.school_name))
  }, [filtered])

  const toggleProgetto = (id: string) => {
    setOpenProgetti(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleCorso = (id: string) => {
    setOpenCorsi(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totaleMateriali = filtered.length
  const totaleProgetti = grouped.length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Repository Materiali</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totaleMateriali} materiali in {totaleProgetti} progetti
        </p>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="🔍 Cerca materiale, corso, scuola..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterProgetto}
          onChange={e => setFilterProgetto(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Tutti i progetti</option>
          {progetti.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
        <select
          value={filterFormatore}
          onChange={e => setFilterFormatore(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Tutti i formatori</option>
          {formatori.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value as '' | 'file' | 'link')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Tutti i tipi</option>
          <option value="file">📄 File</option>
          <option value="link">🔗 Link</option>
        </select>
        {(filterProgetto || filterFormatore || filterTipo || search) && (
          <button
            onClick={() => { setFilterProgetto(''); setFilterFormatore(''); setFilterTipo(''); setSearch('') }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            ✕ Reset
          </button>
        )}
      </div>

      {/* Albero */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <IconFolder className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessun materiale trovato</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(prog => {
            const corsiList = [...prog.corsi.values()]
            const nMateriali = corsiList.reduce((s, c) => s + c.materiali.length, 0)
            const isOpen = openProgetti.has(prog.progetto_id)

            return (
              <div key={prog.progetto_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header progetto */}
                <button
                  onClick={() => toggleProgetto(prog.progetto_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <IconChevron open={isOpen} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <IconFolder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 text-sm">{prog.school_name}</span>
                    {prog.anno_scolastico && (
                      <span className="ml-2 text-xs text-gray-400">{prog.anno_scolastico}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{corsiList.length} cors{corsiList.length === 1 ? 'o' : 'i'}</span>
                    <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {nMateriali} materiali
                    </span>
                  </div>
                </button>

                {/* Corsi */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {corsiList.map((corso, ci) => {
                      const isCorsoOpen = openCorsi.has(corso.corso_id)
                      return (
                        <div key={corso.corso_id} className={ci > 0 ? 'border-t border-gray-100' : ''}>
                          {/* Header corso */}
                          <button
                            onClick={() => toggleCorso(corso.corso_id)}
                            className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 transition-colors text-left"
                          >
                            <IconChevron open={isCorsoOpen} className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-700 font-medium">{corso.corso_title}</span>
                              {corso.formatore_nome && (
                                <span className="ml-2 text-xs text-gray-400">— {corso.formatore_nome}</span>
                              )}
                              {corso.corso_tipo && (
                                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{corso.corso_tipo}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {corso.materiali.length} materiale{corso.materiali.length !== 1 ? 'i' : ''}
                            </span>
                          </button>

                          {/* Materiali */}
                          {isCorsoOpen && (
                            <div className="bg-gray-50 border-t border-gray-100">
                              {corso.materiali.map(m => (
                                <div key={m.id} className="flex items-center gap-3 px-10 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-100 transition-colors group">
                                  {m.tipo === 'file' ? (
                                    <IconFile className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                  ) : (
                                    <IconLink className="w-4 h-4 text-green-400 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-800 truncate">{m.nome}</p>
                                    {m.descrizione && (
                                      <p className="text-xs text-gray-400 truncate">{m.descrizione}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    {m.caricato_da_nome && (
                                      <span className="text-xs text-gray-400 hidden group-hover:inline">{m.caricato_da_nome}</span>
                                    )}
                                    <span className="text-xs text-gray-300">{formatData(m.created_at)}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.tipo === 'file' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                      {m.tipo === 'file' ? 'file' : 'link'}
                                    </span>
                                    <a
                                      href={m.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-400 hover:text-blue-500 transition-colors"
                                      title="Apri"
                                    >
                                      <IconExternalLink className="w-4 h-4" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
