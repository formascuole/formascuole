'use client'
import { useState, useEffect, useRef } from 'react'

interface Sessione {
  id: string
  data: string
  ora_inizio: string | null
  ora_fine: string | null
  ore: number
  tipo_sessione: string | null
  link_videoconferenza: string | null
  completata: boolean
}

interface Materiale {
  id: string
  nome: string
  descrizione: string | null
  tipo: 'file' | 'link'
  url: string
  ordine: number
}

interface Props {
  corsoId: string
  titoloCorso: string
  schoolName: string
  scadenza: string | null
  sessioni: Sessione[]
  materiali: Materiale[]
}

const LS_KEY_PREFIX = 'portale_identita_'

function formatData(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export function MaterialiPublicClient({
  corsoId,
  titoloCorso,
  schoolName,
  scadenza,
  sessioni,
  materiali,
}: Props) {
  const lsKey = LS_KEY_PREFIX + corsoId
  const [identita, setIdentita] = useState<{ nome: string; cognome: string; email: string } | null>(null)
  const [form, setForm] = useState({ nome: '', cognome: '', email: '' })
  const [savingIdentita, setSavingIdentita] = useState(false)
  const [identitaError, setIdentitaError] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(lsKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.nome && parsed.cognome && parsed.email) setIdentita(parsed)
      }
    } catch { /* ignore */ }
  }, [lsKey])

  const handleSaveIdentita = async () => {
    if (!form.nome.trim() || !form.cognome.trim() || !form.email.trim()) {
      setIdentitaError('Tutti i campi sono obbligatori.')
      return
    }
    setSavingIdentita(true)
    setIdentitaError(null)
    try {
      await fetch('/api/materiali-accesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso_id: corsoId, ...form }),
      })
      const id = { nome: form.nome.trim(), cognome: form.cognome.trim(), email: form.email.trim() }
      try { localStorage.setItem(lsKey, JSON.stringify(id)) } catch { /* ignore */ }
      setIdentita(id)
    } catch {
      setIdentitaError('Errore durante il salvataggio. Riprova.')
    } finally {
      setSavingIdentita(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !identita) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('nome', identita.nome)
      fd.append('cognome', identita.cognome)
      fd.append('email', identita.email)
      fd.append('file', uploadFile)
      const res = await fetch(`/api/corsi/${corsoId}/elaborati`, { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json()
        setUploadError(j.error ?? 'Errore nel caricamento.')
        return
      }
      setUploadDone(true)
      setUploadFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setUploadError('Errore di rete. Riprova.')
    } finally {
      setUploading(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const nextSession = sessioni.find(s => s.data >= today && !s.completata) ?? null

  if (!identita) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mb-3">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{titoloCorso}</h1>
            <p className="text-sm text-gray-500 mt-1">{schoolName}</p>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Per accedere ai materiali del corso, inserisci i tuoi dati. Li useremo solo per identificare chi ha partecipato al corso.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Mario"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cognome *</label>
                <input
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  value={form.cognome}
                  onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))}
                  placeholder="Rossi"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="mario.rossi@scuola.it"
              />
            </div>
            {identitaError && <p className="text-xs text-red-500">{identitaError}</p>}
            <button
              onClick={handleSaveIdentita}
              disabled={savingIdentita || !form.nome.trim() || !form.cognome.trim() || !form.email.trim()}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {savingIdentita ? 'Caricamento...' : 'Accedi ai materiali'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold text-gray-900">{titoloCorso}</h1>
          <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-400">
            <span>{schoolName}</span>
            {scadenza && (
              <>
                <span>·</span>
                <span>Accesso disponibile fino al {new Date(scadenza + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Accesso come <span className="font-medium text-gray-600">{identita.nome} {identita.cognome}</span>
            <button
              className="ml-2 text-blue-500 hover:underline"
              onClick={() => {
                try { localStorage.removeItem(lsKey) } catch { /* ignore */ }
                setIdentita(null)
                setForm({ nome: '', cognome: '', email: '' })
              }}
            >
              (cambia)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Prossima sessione */}
        {nextSession && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Prossima sessione</div>
            <div className="font-semibold text-blue-900">{formatData(nextSession.data)}</div>
            {nextSession.ora_inizio && nextSession.ora_fine && (
              <div className="text-sm text-blue-700">
                {nextSession.ora_inizio.substring(0, 5)} – {nextSession.ora_fine.substring(0, 5)} ({nextSession.ore}h)
              </div>
            )}
            {nextSession.link_videoconferenza && (
              <a
                href={nextSession.link_videoconferenza}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <path d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Entra in videoconferenza
              </a>
            )}
          </div>
        )}

        {/* Calendario sessioni */}
        <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Calendario sessioni</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {sessioni.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">Nessuna sessione pianificata.</p>
            ) : sessioni.map(s => {
              const isPast = s.data < today || s.completata
              return (
                <div key={s.id} className={`px-5 py-3 flex items-center gap-3 ${isPast ? 'opacity-60' : ''}`}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: isPast ? '#9ca3af' : '#3b82f6' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 capitalize">{formatData(s.data)}</div>
                    <div className="text-xs text-gray-400">
                      {s.ora_inizio && s.ora_fine ? `${s.ora_inizio.substring(0, 5)}–${s.ora_fine.substring(0, 5)} · ` : ''}{s.ore}h
                      {s.tipo_sessione && s.tipo_sessione !== 'presenza' && (
                        <span className="ml-1">
                          {s.tipo_sessione === 'online' ? '💻' : s.tipo_sessione === 'residenziale' ? '🏨' : ''}
                          {' '}{s.tipo_sessione}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.completata && (
                      <span className="text-xs text-emerald-600 font-medium">Erogata</span>
                    )}
                    {!s.completata && s.link_videoconferenza && (
                      <a
                        href={s.link_videoconferenza}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                          <path d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Entra
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Materiali */}
        <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Materiali del corso</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {materiali.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">Nessun materiale disponibile.</p>
            ) : materiali.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  {m.tipo === 'link' ? (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="14 2 14 8 20 8" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{m.nome}</div>
                  {m.descrizione && <div className="text-xs text-gray-400 truncate">{m.descrizione}</div>}
                </div>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={m.tipo === 'file'}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors shrink-0"
                >
                  {m.tipo === 'link' ? (
                    <>
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Apri
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Scarica
                    </>
                  )}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Upload elaborato */}
        <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Carica elaborato</h2>
            <p className="text-xs text-gray-400 mt-0.5">Il nome del file verrà salvato come: {identita.cognome}_{identita.nome}_nomefile</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            {uploadDone ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 font-medium">
                Elaborato caricato con successo!{' '}
                <button
                  className="underline ml-1"
                  onClick={() => setUploadDone(false)}
                >
                  Carica un altro
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Seleziona file</label>
                  <input
                    ref={fileRef}
                    type="file"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                  />
                </div>
                {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Caricamento...' : 'Carica elaborato'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
