'use client'
import { useState } from 'react'

interface Corso {
  id: string
  title: string
  tipo: string
  ore_totali: number
  modalita?: string | null
  stato_assegnazione?: string | null
  pre_assegnazione?: boolean
  referente_corso_nome?: string | null
  referente_corso_email?: string | null
  referente_corso_telefono?: string | null
  referente_corso_ruolo?: string | null
}

interface Progetto {
  school_name: string
  address?: string
  ref_name?: string
  ref_email?: string
  ref_tel?: string
}

interface Props {
  corsi: Corso[]
  progetto: Progetto
  token: string
  scadenzaAt?: string | null
}

const MODALITA_LABELS: Record<string, string> = {
  presenza: 'In presenza',
  online: 'Online',
  ibrido: 'Ibrido',
  residenziale: 'Residenziale',
  semi_residenziale: 'Semi-residenziale',
}

export function AssegnazioniClient({ corsi, progetto, token, scadenzaAt }: Props) {
  const pending = corsi.filter(c => c.stato_assegnazione === 'in_attesa')
  const responded = corsi.filter(c => c.stato_assegnazione !== 'in_attesa')

  const [decisions, setDecisions] = useState<Record<string, { risposta: 'accettato' | 'rifiutato'; motivazione: string }>>(() =>
    Object.fromEntries(pending.map(c => [c.id, { risposta: 'accettato', motivazione: '' }]))
  )
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="text-green-600">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Risposte inviate!</h1>
          <p className="text-sm text-gray-500">Il coordinatore è stato notificato delle tue scelte. Puoi chiudere questa pagina.</p>
        </div>
      </div>
    )
  }

  if (pending.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="text-green-600">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Hai già risposto</h1>
          <p className="text-sm text-gray-500">Hai già risposto a tutte le assegnazioni per questa scuola.</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload = pending.map(c => ({
        corso_id: c.id,
        risposta: decisions[c.id]?.risposta ?? 'accettato',
        ...(decisions[c.id]?.risposta === 'rifiutato' && decisions[c.id].motivazione
          ? { motivazione: decisions[c.id].motivazione }
          : {}),
      }))
      const res = await fetch(`/api/assegnazioni/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: payload }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Errore durante l\'invio. Riprova.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Errore di rete. Verifica la connessione e riprova.')
    } finally {
      setSubmitting(false)
    }
  }

  const pendingRifiuti = pending.filter(c => decisions[c.id]?.risposta === 'rifiutato')
  const allRifiutiHaveMotivazione = pendingRifiuti.every(c => decisions[c.id]?.motivazione?.trim())

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* School header */}
        <div className="bg-white rounded-xl p-6 mb-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="text-blue-600">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{progetto.school_name}</h1>
              {progetto.address && <p className="text-sm text-gray-500">{progetto.address}</p>}
            </div>
          </div>

          {progetto.ref_name && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
              <span className="font-medium">Referente coordinamento: </span>
              {progetto.ref_name}
              {progetto.ref_email && (
                <> · <a href={`mailto:${progetto.ref_email}`} className="text-blue-600 hover:underline">{progetto.ref_email}</a></>
              )}
              {progetto.ref_tel && (
                <> · <a href={`tel:${progetto.ref_tel}`} className="text-blue-600 hover:underline">{progetto.ref_tel}</a></>
              )}
            </div>
          )}

          {scadenzaAt && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Questo link scade il{' '}
              {new Date(scadenzaAt).toLocaleString('it-IT', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Indica per ogni corso qui sotto se accetti o rifiuti l&apos;assegnazione.
        </p>

        {/* Pending courses */}
        {pending.map(corso => (
          <div key={corso.id} className="bg-white rounded-xl p-6 mb-4 border border-gray-100 shadow-sm">
            <div className="mb-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-semibold text-gray-900">{corso.title}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  corso.tipo === 'Lab' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {corso.tipo}
                </span>
                {corso.pre_assegnazione && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    Pre-assegnazione
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{corso.ore_totali}h totali</span>
                {corso.modalita && MODALITA_LABELS[corso.modalita] && (
                  <span>· {MODALITA_LABELS[corso.modalita]}</span>
                )}
              </div>
            </div>

            {/* Referente scolastico */}
            {corso.referente_corso_nome && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-medium text-gray-700 mb-0.5">Referente scolastico per questo corso</div>
                <div className="text-gray-600">
                  {corso.referente_corso_nome}
                  {corso.referente_corso_ruolo ? ` — ${corso.referente_corso_ruolo}` : ''}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-gray-500 mt-1">
                  {corso.referente_corso_email && (
                    <a href={`mailto:${corso.referente_corso_email}`} className="hover:text-blue-600 text-xs">
                      {corso.referente_corso_email}
                    </a>
                  )}
                  {corso.referente_corso_telefono && (
                    <a href={`tel:${corso.referente_corso_telefono}`} className="hover:text-blue-600 text-xs">
                      {corso.referente_corso_telefono}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Accept / Reject toggle */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setDecisions(d => ({ ...d, [corso.id]: { ...d[corso.id], risposta: 'accettato' } }))}
                className={`flex-1 py-2.5 rounded-[8px] text-sm font-medium transition-colors border ${
                  decisions[corso.id]?.risposta === 'accettato'
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-green-400 hover:text-green-700'
                }`}
              >
                ✓ Accetta
              </button>
              <button
                onClick={() => setDecisions(d => ({ ...d, [corso.id]: { ...d[corso.id], risposta: 'rifiutato' } }))}
                className={`flex-1 py-2.5 rounded-[8px] text-sm font-medium transition-colors border ${
                  decisions[corso.id]?.risposta === 'rifiutato'
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-red-400 hover:text-red-700'
                }`}
              >
                ✗ Rifiuta
              </button>
            </div>

            {decisions[corso.id]?.risposta === 'rifiutato' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Motivazione del rifiuto <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={decisions[corso.id].motivazione}
                  onChange={e => setDecisions(d => ({ ...d, [corso.id]: { ...d[corso.id], motivazione: e.target.value } }))}
                  placeholder="Spiega brevemente il motivo del rifiuto..."
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-red-400 transition-colors resize-none"
                />
              </div>
            )}
          </div>
        ))}

        {/* Already-responded courses */}
        {responded.length > 0 && (
          <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100 shadow-sm">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Già risposto</div>
            <div className="space-y-2">
              {responded.map(corso => (
                <div key={corso.id} className="flex items-center justify-between text-sm py-1">
                  <span className="text-gray-700">{corso.title}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    corso.stato_assegnazione === 'accettato'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {corso.stato_assegnazione === 'accettato' ? 'Accettato' : 'Rifiutato'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || (pendingRifiuti.length > 0 && !allRifiutiHaveMotivazione)}
          className="w-full py-3 bg-[#d64b55] text-white font-semibold rounded-[8px] hover:bg-[#c04050] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {submitting ? 'Invio in corso…' : 'Conferma le tue scelte'}
        </button>
        {pendingRifiuti.length > 0 && !allRifiutiHaveMotivazione && (
          <p className="text-xs text-red-600 text-center mt-2">
            Inserisci la motivazione per tutti i corsi rifiutati
          </p>
        )}
      </div>
    </div>
  )
}
