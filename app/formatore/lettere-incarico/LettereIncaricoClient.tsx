'use client'

import { useState } from 'react'

type LetteraFormatore = {
  id: string; title: string; tipo: string; ore_totali: number
  lettera_incarico_url: string
  lettera_incarico_firmata: boolean
  lettera_incarico_firmata_at: string | null
  lettera_incarico_inviata_at: string | null
}

type LetteraTutor = {
  id: string; title: string; ore_tutoraggio: number
  lettera_tutor_url: string
  lettera_tutor_firmata: boolean
  lettera_tutor_firmata_at: string | null
  lettera_tutor_inviata_at: string | null
}

type ProgettoLettere = {
  id: string; school_name: string
  lettere_formatore: LetteraFormatore[]
  lettere_tutor: LetteraTutor[]
}

interface Props {
  progetti: ProgettoLettere[]
  role: 'formatore' | 'tutor'
}

type FirmaItem = { corsoId: string; tipo: 'formatore' | 'tutor'; title: string }

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function BadgeStato({ firmata, firmataAt, inviatAt }: { firmata: boolean; firmataAt: string | null; inviatAt: string | null }) {
  if (firmata) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Firmata il {formatDate(firmataAt)}
      </span>
    )
  }
  if (!inviatAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        In attesa di invio
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2"/></svg>
      Da firmare
    </span>
  )
}

export function LettereIncaricoClient({ progetti, role }: Props) {
  // For each corso we track local signed state after signing
  const [firmateFormatore, setFirmateFormatore] = useState<Record<string, { firmata: boolean; firmataAt: string }>>({})
  const [firmateTutor, setFirmateTutor] = useState<Record<string, { firmata: boolean; firmataAt: string }>>({})

  // Bulk sign modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [firmaProgress, setFirmaProgress] = useState<{ current: number; total: number } | null>(null)
  const [firmaErrors, setFirmaErrors] = useState<string[]>([])
  const [firmaComplete, setFirmaComplete] = useState(false)

  // Collect all unsigned letters
  const allUnsigned: FirmaItem[] = []
  for (const p of progetti) {
    for (const l of p.lettere_formatore) {
      const signed = firmateFormatore[l.id]?.firmata ?? l.lettera_incarico_firmata
      if (!signed && l.lettera_incarico_inviata_at) {
        allUnsigned.push({ corsoId: l.id, tipo: 'formatore', title: `${l.title} (${p.school_name})` })
      }
    }
    for (const l of p.lettere_tutor) {
      const signed = firmateTutor[l.id]?.firmata ?? l.lettera_tutor_firmata
      if (!signed && l.lettera_tutor_inviata_at) {
        allUnsigned.push({ corsoId: l.id, tipo: 'tutor', title: `${l.title} — tutor (${p.school_name})` })
      }
    }
  }

  const handleOpenModal = () => {
    setSelectedIds(new Set(allUnsigned.map(i => `${i.tipo}::${i.corsoId}`)))
    setFirmaProgress(null)
    setFirmaErrors([])
    setFirmaComplete(false)
    setModalOpen(true)
  }

  const toggleSelect = (key: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleFirmaTutte = async () => {
    const toSign = allUnsigned.filter(i => selectedIds.has(`${i.tipo}::${i.corsoId}`))
    if (!toSign.length) return

    setFirmaProgress({ current: 0, total: toSign.length })
    setFirmaErrors([])
    setFirmaComplete(false)

    const errors: string[] = []
    for (let i = 0; i < toSign.length; i++) {
      const item = toSign[i]
      setFirmaProgress({ current: i + 1, total: toSign.length })
      try {
        const endpoint = item.tipo === 'formatore'
          ? `/api/corsi/${item.corsoId}/firma-lettera`
          : `/api/corsi/${item.corsoId}/firma-lettera-tutor`
        const res = await fetch(endpoint, { method: 'POST' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          errors.push(`${item.title}: ${data.error || 'Errore sconosciuto'}`)
        } else {
          const now = new Date().toISOString()
          if (item.tipo === 'formatore') {
            setFirmateFormatore(prev => ({ ...prev, [item.corsoId]: { firmata: true, firmataAt: now } }))
          } else {
            setFirmateTutor(prev => ({ ...prev, [item.corsoId]: { firmata: true, firmataAt: now } }))
          }
        }
      } catch {
        errors.push(`${item.title}: Errore di rete`)
      }
    }

    setFirmaErrors(errors)
    setFirmaComplete(true)
    setFirmaProgress(null)
  }

  const handleSingleFirma = async (corsoId: string, tipo: 'formatore' | 'tutor') => {
    const endpoint = tipo === 'formatore'
      ? `/api/corsi/${corsoId}/firma-lettera`
      : `/api/corsi/${corsoId}/firma-lettera-tutor`
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (res.ok) {
        const now = new Date().toISOString()
        if (tipo === 'formatore') {
          setFirmateFormatore(prev => ({ ...prev, [corsoId]: { firmata: true, firmataAt: now } }))
        } else {
          setFirmateTutor(prev => ({ ...prev, [corsoId]: { firmata: true, firmataAt: now } }))
        }
      }
    } catch { /* ignore */ }
  }

  const totDaFirmare = allUnsigned.length

  if (progetti.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Le mie lettere d&apos;incarico</h1>
        <p className="text-gray-500 mt-8 text-center">Nessuna lettera d&apos;incarico disponibile.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Le mie lettere d&apos;incarico</h1>
          {totDaFirmare > 0 && (
            <p className="text-sm text-red-600 mt-1">
              {totDaFirmare === 1 ? '1 lettera da firmare' : `${totDaFirmare} lettere da firmare`}
            </p>
          )}
        </div>
        {totDaFirmare > 0 && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#d64b55' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Firma tutte le lettere
          </button>
        )}
      </div>

      <div className="space-y-6">
        {progetti.map(progetto => (
          <div key={progetto.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800 text-sm">{progetto.school_name}</h2>
            </div>

            {/* Formatore letters */}
            {role === 'formatore' && progetto.lettere_formatore.length > 0 && (
              <div>
                {progetto.lettere_formatore.length > 0 && progetto.lettere_tutor.length > 0 && (
                  <div className="px-5 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Lettere formatore</span>
                  </div>
                )}
                {progetto.lettere_formatore.map((l, idx) => {
                  const signed = firmateFormatore[l.id]?.firmata ?? l.lettera_incarico_firmata
                  const signedAt = firmateFormatore[l.id]?.firmataAt ?? l.lettera_incarico_firmata_at
                  const canSign = !signed && !!l.lettera_incarico_inviata_at
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center justify-between px-5 py-3 ${idx < progetto.lettere_formatore.length - 1 || progetto.lettere_tutor.length > 0 ? 'border-b border-gray-100' : ''}`}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-gray-800 truncate">{l.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{l.ore_totali}h · {l.tipo}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <BadgeStato firmata={signed} firmataAt={signedAt} inviatAt={l.lettera_incarico_inviata_at} />
                        {canSign && (
                          <button
                            onClick={() => handleSingleFirma(l.id, 'formatore')}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Firma
                          </button>
                        )}
                        {signed && (
                          <a
                            href={l.lettera_incarico_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Scarica PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tutor letters */}
            {progetto.lettere_tutor.length > 0 && (
              <div>
                {progetto.lettere_tutor.length > 0 && role === 'formatore' && progetto.lettere_formatore.length > 0 && (
                  <div className="px-5 pt-3 pb-1 border-t border-gray-100">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Lettere tutoraggio</span>
                  </div>
                )}
                {progetto.lettere_tutor.map((l, idx) => {
                  const signed = firmateTutor[l.id]?.firmata ?? l.lettera_tutor_firmata
                  const signedAt = firmateTutor[l.id]?.firmataAt ?? l.lettera_tutor_firmata_at
                  const canSign = !signed && !!l.lettera_tutor_inviata_at
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center justify-between px-5 py-3 ${idx < progetto.lettere_tutor.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-gray-800 truncate">{l.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{l.ore_tutoraggio}h tutoraggio</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <BadgeStato firmata={signed} firmataAt={signedAt} inviatAt={l.lettera_tutor_inviata_at} />
                        {canSign && (
                          <button
                            onClick={() => handleSingleFirma(l.id, 'tutor')}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Firma
                          </button>
                        )}
                        {signed && (
                          <a
                            href={l.lettera_tutor_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Scarica PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bulk sign modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Firma lettere d&apos;incarico</h3>
              {!firmaProgress && (
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>

            <div className="px-6 py-4">
              {firmaComplete ? (
                <div className="text-center py-4">
                  {firmaErrors.length === 0 ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <p className="font-semibold text-gray-900">Lettere firmate con successo</p>
                      <p className="text-sm text-gray-500 mt-1">Tutte le lettere selezionate sono state firmate.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-900 mb-2">Completato con errori</p>
                      <div className="text-left bg-red-50 rounded-lg p-3 space-y-1">
                        {firmaErrors.map((e, i) => (
                          <p key={i} className="text-xs text-red-700">{e}</p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : firmaProgress ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full border-2 border-gray-200 border-t-red-500 animate-spin mx-auto mb-3" />
                  <p className="font-semibold text-gray-900">Firma in corso...</p>
                  <p className="text-sm text-gray-500 mt-1">({firmaProgress.current}/{firmaProgress.total})</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Seleziona le lettere da firmare. Firmando, accetti i termini dell&apos;incarico.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allUnsigned.map(item => {
                      const key = `${item.tipo}::${item.corsoId}`
                      return (
                        <label key={key} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded"
                            checked={selectedIds.has(key)}
                            onChange={() => toggleSelect(key)}
                          />
                          <span className="text-sm text-gray-700">{item.title}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              {firmaComplete ? (
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: '#d64b55' }}
                >
                  Chiudi
                </button>
              ) : firmaProgress ? null : (
                <>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleFirmaTutte}
                    disabled={selectedIds.size === 0}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: '#d64b55' }}
                  >
                    Firma {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
