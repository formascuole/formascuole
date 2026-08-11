'use client'
import React, { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import type { LetteraItem } from './page'

interface Props {
  items: LetteraItem[]
  isSuperAdmin: boolean
  nLetteredMancanti: number
}

interface GenProgress {
  processed: number
  total: number
  item: string
  running: boolean
  done: boolean
  error: string | null
}

export function LettereIncaricoClient({ items, isSuperAdmin, nLetteredMancanti }: Props) {
  const router = useRouter()
  const [filterAnno, setFilterAnno] = useState('')
  const [filterPersona, setFilterPersona] = useState('')
  const [filterTipo, setFilterTipo] = useState<'' | 'formatore' | 'tutor'>('')
  const [filterStato, setFilterStato] = useState<'' | 'non_firmata' | 'firmata'>('')
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const startGenera = useCallback(async () => {
    abortRef.current = new AbortController()
    setGenProgress({ processed: 0, total: 0, item: '', running: true, done: false, error: null })
    try {
      const res = await fetch('/api/admin/genera-lettere-mancanti', {
        method: 'POST',
        signal: abortRef.current.signal,
      })
      if (!res.ok) {
        setGenProgress(p => p ? { ...p, running: false, error: `Errore ${res.status}` } : p)
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
              setGenProgress(p => p ? { ...p, total: msg.total } : p)
            } else if (msg.type === 'progress') {
              setGenProgress(p => p ? { ...p, processed: msg.processed, total: msg.total, item: msg.item } : p)
            } else if (msg.type === 'complete') {
              setGenProgress(p => p ? { ...p, running: false, done: true, processed: msg.processed, total: msg.total } : p)
              router.refresh()
            } else if (msg.type === 'error') {
              setGenProgress(p => p ? { ...p, running: false, error: msg.message } : p)
            }
          } catch { /* malformed line */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGenProgress(p => p ? { ...p, running: false, error: String(err) } : p)
      }
    }
  }, [router])

  const stopGenera = useCallback(() => {
    abortRef.current?.abort()
    setGenProgress(p => p ? { ...p, running: false } : p)
  }, [])

  const anni = useMemo(() => {
    const s = new Set(items.map(i => i.anno).filter(Boolean) as string[])
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [items])

  const persone = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of items) map.set(i.persona_id, i.persona_nome)
    return [...map.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [items])

  const filtered = useMemo(() => items.filter(i => {
    if (filterAnno && i.anno !== filterAnno) return false
    if (filterPersona && i.persona_id !== filterPersona) return false
    if (filterTipo && i.tipo !== filterTipo) return false
    if (filterStato === 'firmata' && !i.firmata) return false
    if (filterStato === 'non_firmata' && i.firmata) return false
    return true
  }), [items, filterAnno, filterPersona, filterTipo, filterStato])

  const handleExport = () => {
    const rows = filtered.map(i => ({
      'Tipo': i.tipo === 'formatore' ? 'Formatore' : 'Tutor',
      'Nome': i.persona_nome,
      'Email': i.persona_email,
      'Corso': i.corso_title,
      'Scuola': i.school_name,
      'Anno': i.anno ?? '—',
      'Stato': i.firmata ? 'Firmata' : 'In attesa di firma',
      'Data firma': i.firmata_at ? new Date(i.firmata_at).toLocaleDateString('it-IT') : '—',
      'IP firma': i.firmata_ip ?? '—',
      'URL PDF': i.url,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lettere')
    const today = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `LettereIncarico_${today}.xlsx`)
  }

  const firmateCount = filtered.filter(i => i.firmata).length
  const nonFirmateCount = filtered.filter(i => !i.firmata).length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lettere d&apos;incarico</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} lettera{filtered.length !== 1 ? 'e' : ''} ·{' '}
            <span className="text-green-600">{firmateCount} firmate</span> ·{' '}
            <span className="text-amber-600">{nonFirmateCount} in attesa</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Genera lettere mancanti — super_admin only */}
          {isSuperAdmin && (
            genProgress?.running ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50 border border-blue-100 px-3 py-2 rounded-[7px]">
                <svg className="animate-spin w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="max-w-[180px] truncate">{genProgress.item}</span>
                <span className="font-semibold shrink-0">
                  {genProgress.processed}/{genProgress.total}
                </span>
                <button
                  onClick={stopGenera}
                  className="ml-1 text-red-500 hover:text-red-700 font-medium shrink-0"
                >
                  Stop
                </button>
              </div>
            ) : genProgress?.done ? (
              <span className="text-xs text-green-600 font-medium">
                ✓ {genProgress.processed} lettera{genProgress.processed !== 1 ? 'e' : ''} generate
              </span>
            ) : genProgress?.error ? (
              <span className="text-xs text-red-600">Errore: {genProgress.error}</span>
            ) : nLetteredMancanti > 0 ? (
              <button
                onClick={startGenera}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 border border-blue-200 hover:bg-blue-50 px-3 py-2 rounded-[7px] transition-colors bg-blue-50/50"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5"/>
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Genera lettere mancanti
                <span className="bg-blue-200 text-blue-800 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none">
                  {nLetteredMancanti}
                </span>
              </button>
            ) : null
          )}

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-[7px] transition-colors"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Esporta Excel
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end" style={{ border: '0.5px solid #e5e5e5' }}>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Anno</label>
          <select
            value={filterAnno}
            onChange={e => setFilterAnno(e.target.value)}
            className="text-sm border border-gray-200 rounded-[7px] px-2.5 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white"
          >
            <option value="">Tutti gli anni</option>
            {anni.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Persona</label>
          <select
            value={filterPersona}
            onChange={e => setFilterPersona(e.target.value)}
            className="text-sm border border-gray-200 rounded-[7px] px-2.5 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white"
          >
            <option value="">Tutte le persone</option>
            {persone.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value as '' | 'formatore' | 'tutor')}
            className="text-sm border border-gray-200 rounded-[7px] px-2.5 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white"
          >
            <option value="">Tutti i tipi</option>
            <option value="formatore">Formatore</option>
            <option value="tutor">Tutor</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Stato</label>
          <select
            value={filterStato}
            onChange={e => setFilterStato(e.target.value as '' | 'non_firmata' | 'firmata')}
            className="text-sm border border-gray-200 rounded-[7px] px-2.5 py-1.5 focus:outline-none focus:border-[#d64b55] bg-white"
          >
            <option value="">Tutti gli stati</option>
            <option value="non_firmata">In attesa di firma</option>
            <option value="firmata">Firmata</option>
          </select>
        </div>
        {(filterAnno || filterPersona || filterTipo || filterStato) && (
          <button
            onClick={() => { setFilterAnno(''); setFilterPersona(''); setFilterTipo(''); setFilterStato('') }}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors mt-4"
          >
            Azzera filtri
          </button>
        )}
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            Nessuna lettera trovata con i filtri selezionati.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Corso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scuola</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data firma</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${
                      item.tipo === 'formatore' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {item.tipo === 'formatore' ? 'Formatore' : 'Tutor'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{item.persona_nome}</div>
                    <div className="text-xs text-gray-400">{item.persona_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/progetti/${item.progetto_id}/corsi/${item.corso_id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {item.corso_title}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.school_name}</td>
                  <td className="px-4 py-3">
                    {item.firmata ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                        <svg width="9" height="9" fill="none" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                        Firmata
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                        In attesa
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {item.firmata_at
                      ? new Date(item.firmata_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
