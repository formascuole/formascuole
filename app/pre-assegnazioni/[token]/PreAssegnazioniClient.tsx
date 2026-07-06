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

const MOTIVAZIONI_NON_DISPONIBILE = [
  'Indisponibile nelle date previste',
  'Materia non di mia competenza',
  'Sede troppo lontana',
  'Impegni personali già programmati',
  'Altro',
]

export function PreAssegnazioniClient({ corsi, progetto, token, scadenzaAt }: Props) {
  const pending = corsi.filter(c => c.stato_assegnazione === 'in_attesa')
  const responded = corsi.filter(c => c.stato_assegnazione !== 'in_attesa')

  const [decisions, setDecisions] = useState<Record<string, 'accettato' | 'rifiutato' | null>>(
    () => Object.fromEntries(pending.map(c => [c.id, null]))
  )
  const [motivazioni, setMotivazioni] = useState<Record<string, string>>(
    () => Object.fromEntries(pending.map(c => [c.id, '']))
  )
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const nDisponibili = pending.filter(c => decisions[c.id] === 'accettato').length
  const nNonDisponibili = pending.filter(c => decisions[c.id] === 'rifiutato').length
  const nPending = pending.filter(c => decisions[c.id] === null).length
  const allAnswered = nPending === 0

  const acceptAll = () => setDecisions(Object.fromEntries(pending.map(c => [c.id, 'accettato'])))
  const rejectAll = () => setDecisions(Object.fromEntries(pending.map(c => [c.id, 'rifiutato'])))

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload = pending.map(c => ({
        corso_id: c.id,
        risposta: decisions[c.id] as 'accettato' | 'rifiutato',
        ...(decisions[c.id] === 'rifiutato' && motivazioni[c.id]
          ? { motivazione: motivazioni[c.id] }
          : {}),
      }))
      const res = await fetch(`/api/assegnazioni/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: payload }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || "Errore durante l'invio. Riprova.")
        return
      }
      setSubmitted(true)
    } catch {
      setError('Errore di rete. Verifica la connessione e riprova.')
    } finally {
      setSubmitting(false)
    }
  }

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
          <p className="text-sm text-gray-500">Il coordinatore è stato notificato delle tue disponibilità. Puoi chiudere questa pagina.</p>
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
          <p className="text-sm text-gray-500">Hai già indicato la tua disponibilità per tutti i corsi di questa scuola.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-xl p-6 mb-4 border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-0.5">Gestisci le tue pre-assegnazioni</h1>
              <p className="text-sm text-gray-600">{progetto.school_name}</p>
              {progetto.address && <p className="text-xs text-gray-400 mt-0.5">{progetto.address}</p>}
            </div>
            {pending.length > 1 && (
              <div className="flex items-center gap-2.5 shrink-0 mt-1">
                <button onClick={acceptAll} className="text-xs font-medium text-green-700 hover:underline">
                  Disponibile per tutti
                </button>
                <span className="text-gray-300 text-xs">|</span>
                <button onClick={rejectAll} className="text-xs font-medium text-red-600 hover:underline">
                  Non disponibile per nessuno
                </button>
              </div>
            )}
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
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{corso.ore_totali}h totali</span>
                {corso.modalita && MODALITA_LABELS[corso.modalita] && (
                  <span>· {MODALITA_LABELS[corso.modalita]}</span>
                )}
              </div>
            </div>

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

            {/* Radio buttons */}
            <div className="space-y-2 mb-3">
              <label className={`flex items-center gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                decisions[corso.id] === 'accettato'
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}>
                <input
                  type="radio"
                  name={`decision-${corso.id}`}
                  value="accettato"
                  checked={decisions[corso.id] === 'accettato'}
                  onChange={() => setDecisions(d => ({ ...d, [corso.id]: 'accettato' }))}
                  className="accent-green-600"
                />
                <span className={`text-sm font-medium ${decisions[corso.id] === 'accettato' ? 'text-green-700' : 'text-gray-700'}`}>
                  ✅ Disponibile
                </span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                decisions[corso.id] === 'rifiutato'
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}>
                <input
                  type="radio"
                  name={`decision-${corso.id}`}
                  value="rifiutato"
                  checked={decisions[corso.id] === 'rifiutato'}
                  onChange={() => setDecisions(d => ({ ...d, [corso.id]: 'rifiutato' }))}
                  className="accent-red-600"
                />
                <span className={`text-sm font-medium ${decisions[corso.id] === 'rifiutato' ? 'text-red-700' : 'text-gray-700'}`}>
                  ❌ Non disponibile
                </span>
              </label>
            </div>

            {decisions[corso.id] === 'rifiutato' && (
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  Seleziona motivazione <span className="text-gray-400">(opzionale)</span>
                </label>
                <select
                  value={motivazioni[corso.id] || ''}
                  onChange={e => setMotivazioni(m => ({ ...m, [corso.id]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 bg-white focus:outline-none focus:border-red-300 transition-colors"
                >
                  <option value="">— nessuna motivazione —</option>
                  {MOTIVAZIONI_NON_DISPONIBILE.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}

        {/* Already-responded */}
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
                    {corso.stato_assegnazione === 'accettato' ? 'Disponibile' : 'Non disponibile'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        {/* Summary + Submit */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-5 text-sm mb-4 flex-wrap">
            <span className="text-gray-700">✅ <strong>{nDisponibili}</strong> disponibile</span>
            <span className="text-gray-700">❌ <strong>{nNonDisponibili}</strong> non disponibile</span>
            {nPending > 0 && (
              <span className="text-amber-600">⏳ <strong>{nPending}</strong> in attesa</span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !allAnswered}
            className="w-full py-3 bg-[#d64b55] text-white font-semibold rounded-[8px] hover:bg-[#c04050] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm tracking-wide uppercase"
          >
            {submitting ? 'Invio in corso…' : 'Invia tutte le risposte'}
          </button>
          {!allAnswered && (
            <p className="text-xs text-gray-400 text-center mt-2">
              Rispondi a tutti i corsi per abilitare l&apos;invio
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
