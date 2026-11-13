'use client'
import { useState, useEffect, useCallback } from 'react'

interface Progetto { id: string; school_name: string; linea_finanziamento: string | null }
interface LogEntry {
  id: number
  created_at: string
  tipologia: string
  oggetto: string
  n_inviati: number
  n_errori: number
  progetto_id: string | null
  progetti: { school_name: string } | null
}
interface Destinatario { email: string; nome: string; progetto_id?: string; corso?: string; scuola?: string }

const TIPOLOGIE = [
  { value: 'tutti',           label: 'Tutti gli utenti',          desc: 'Formatori e tutor (esclusi admin)' },
  { value: 'admin',           label: 'Admin',                      desc: 'Solo amministratori della piattaforma' },
  { value: 'progetto',        label: 'Utenti di un progetto',      desc: 'Formatori e tutor di un progetto specifico' },
  { value: 'ore_non_firmate', label: 'Ore non firmate',            desc: 'Formatori/tutor con sessioni completate non firmate' },
]

const TESTO_ORE_NON_FIRMATE = `Gentile [Nome Cognome],

ti scriviamo per ricordarti che risultano ancora delle ore non firmate relative al tuo corso sulla Piattaforma Formascuole.

Ti invitiamo ad accedere alla Piattaforma Formascuole e completare la firma delle presenze il prima possibile.

Per qualsiasi dubbio o problema tecnico, puoi rispondere a questa email o contattarci direttamente.

Cordiali saluti,
Staff Formascuole`

interface Props {
  progetti: Progetto[]
  logs: LogEntry[]
}

export function ComunicazioniClient({ progetti, logs: initialLogs }: Props) {
  const [tipologia, setTipologia] = useState<string>('')
  const [progettoId, setProgettoId] = useState<string>('')
  const [oggetto, setOggetto] = useState<string>('')
  const [corpo, setCorpo] = useState<string>('')
  const [step, setStep] = useState<'form' | 'anteprima' | 'invio' | 'done'>('form')
  const [destinatari, setDestinatari] = useState<Destinatario[]>([])
  const [loadingDest, setLoadingDest] = useState(false)
  const [sending, setSending] = useState(false)
  const [risultato, setRisultato] = useState<{ n_inviati: number; n_errori: number } | null>(null)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [progettoSearch, setProgettoSearch] = useState('')

  // Auto-compila oggetto e corpo per alcune tipologie
  useEffect(() => {
    if (tipologia === 'ore_non_firmate') {
      setOggetto('Ore non firmate — Piattaforma Formascuole')
      setCorpo(TESTO_ORE_NON_FIRMATE)
    } else if (tipologia === 'progetto' && progettoId) {
      const p = progetti.find(x => x.id === progettoId)
      if (p) setOggetto(`Progetto ${p.school_name}${p.linea_finanziamento ? ` — ${p.linea_finanziamento}` : ''}`)
    } else {
      setOggetto('')
      setCorpo('')
    }
  }, [tipologia, progettoId, progetti])

  const loadDestinatari = useCallback(async () => {
    if (!tipologia) return
    if (tipologia === 'progetto' && !progettoId) return
    setLoadingDest(true)
    setError('')
    try {
      const params = new URLSearchParams({ tipologia })
      if (progettoId) params.set('progetto_id', progettoId)
      const res = await fetch(`/api/comunicazioni?${params}`)
      if (!res.ok) throw new Error((await res.json()).error)
      setDestinatari(await res.json())
      setStep('anteprima')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setLoadingDest(false)
    }
  }, [tipologia, progettoId])

  const handleInvia = async () => {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/comunicazioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipologia, progetto_id: progettoId || undefined, oggetto, corpo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRisultato(data)
      setStep('done')
      // Ricarica log
      const logsRes = await fetch('/api/comunicazioni/log')
      if (logsRes.ok) setLogs(await logsRes.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante l\'invio')
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    setTipologia(''); setProgettoId(''); setOggetto(''); setCorpo('')
    setStep('form'); setDestinatari([]); setRisultato(null); setError('')
  }

  const progettiFiltrati = progetti.filter(p =>
    !progettoSearch || p.school_name.toLowerCase().includes(progettoSearch.toLowerCase()) ||
    (p.linea_finanziamento ?? '').toLowerCase().includes(progettoSearch.toLowerCase())
  )

  const tipologiaLabel = TIPOLOGIE.find(t => t.value === tipologia)?.label ?? tipologia

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comunicazioni</h1>
        <p className="text-sm text-gray-500 mt-1">Invia email massive agli utenti della piattaforma</p>
      </div>

      {/* ── STEP 1: Form ── */}
      {step === 'form' && (
        <div className="bg-white rounded-xl p-6 space-y-5" style={{ border: '0.5px solid #e5e5e5' }}>
          {/* Tipologia */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Destinatari</label>
            <div className="grid grid-cols-1 gap-2">
              {TIPOLOGIE.map(t => (
                <label key={t.value} className={`flex items-start gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${tipologia === t.value ? 'border-[#d64b55] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="tipologia" value={t.value} checked={tipologia === t.value}
                    onChange={() => { setTipologia(t.value); setProgettoId('') }}
                    className="mt-0.5 accent-[#d64b55]" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{t.label}</div>
                    <div className="text-xs text-gray-400">{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Selettore progetto */}
          {tipologia === 'progetto' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Progetto</label>
              <input
                value={progettoSearch}
                onChange={e => setProgettoSearch(e.target.value)}
                placeholder="Cerca scuola o finanziamento…"
                className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 mb-2 focus:outline-none focus:border-[#d64b55]"
              />
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-[7px]">
                {progettiFiltrati.map(p => (
                  <label key={p.id} className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${progettoId === p.id ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <input type="radio" name="progetto" value={p.id} checked={progettoId === p.id}
                      onChange={() => setProgettoId(p.id)} className="accent-[#d64b55]" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{p.school_name}</div>
                      {p.linea_finanziamento && <div className="text-xs text-gray-400">{p.linea_finanziamento}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Oggetto */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Oggetto</label>
            <input
              value={oggetto}
              onChange={e => setOggetto(e.target.value)}
              placeholder="Oggetto dell'email…"
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55]"
            />
          </div>

          {/* Corpo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Testo dell&apos;email
              <span className="font-normal text-gray-400 ml-2">— usa [Nome Cognome] per personalizzare</span>
            </label>
            <textarea
              value={corpo}
              onChange={e => setCorpo(e.target.value)}
              rows={10}
              placeholder="Testo dell'email…"
              className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] resize-y font-mono"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-[7px]">{error}</p>}

          <div className="flex justify-end">
            <button
              onClick={loadDestinatari}
              disabled={!tipologia || (tipologia === 'progetto' && !progettoId) || !oggetto.trim() || !corpo.trim() || loadingDest}
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-[7px] text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#d64b55' }}
            >
              {loadingDest ? 'Caricamento…' : 'Vedi anteprima →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Anteprima ── */}
      {step === 'anteprima' && (
        <div className="space-y-4">
          {/* Riepilogo destinatari */}
          <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e5e5' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">
                {destinatari.length} destinatar{destinatari.length === 1 ? 'io' : 'i'} · {tipologiaLabel}
              </h2>
              <button onClick={() => setStep('form')} className="text-xs text-gray-400 hover:text-gray-600">← Modifica</button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {destinatari.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="font-medium text-gray-700 w-48 truncate">{d.nome || '—'}</span>
                  <span className="text-gray-400 truncate">{d.email}</span>
                  {d.corso && <span className="text-xs text-gray-300 ml-auto truncate max-w-[180px]">{d.corso}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Anteprima email */}
          <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e5e5' }}>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Anteprima email</h2>
            <div className="text-xs text-gray-400 mb-1">Da: <span className="text-gray-600">Formascuole &lt;info@formascuole.it&gt;</span></div>
            <div className="text-xs text-gray-400 mb-3">Oggetto: <span className="text-gray-800 font-medium">{oggetto}</span></div>
            <div className="border border-gray-100 rounded-[7px] p-4 bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {corpo.replace(/\[Nome Cognome\]/g, destinatari[0]?.nome || 'Mario Rossi')}
            </div>
            {tipologia === 'ore_non_firmate' && (
              <div className="mt-3 p-3 bg-blue-50 rounded-[7px] text-xs text-blue-700">
                📌 Verrà aggiunto automaticamente un bottone &quot;Firma le tue ore →&quot; con il link al progetto specifico per ogni destinatario.
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-[7px]">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button onClick={() => setStep('form')} className="text-sm font-medium px-4 py-2.5 rounded-[7px] border border-gray-200 text-gray-600 hover:bg-gray-50">
              ← Modifica
            </button>
            <button
              onClick={handleInvia}
              disabled={sending}
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-[7px] text-white disabled:opacity-40"
              style={{ backgroundColor: '#d64b55' }}
            >
              {sending ? 'Invio in corso…' : `Invia a ${destinatari.length} destinatar${destinatari.length === 1 ? 'io' : 'i'}`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ── */}
      {step === 'done' && risultato && (
        <div className="bg-white rounded-xl p-8 text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#fbeced' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" stroke="#d64b55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Email inviate!</h2>
          <p className="text-gray-500 text-sm mb-1">
            <span className="font-semibold text-gray-800">{risultato.n_inviati}</span> email inviate con successo
          </p>
          {risultato.n_errori > 0 && (
            <p className="text-orange-500 text-sm mb-1">{risultato.n_errori} errori di invio</p>
          )}
          <button onClick={handleReset} className="mt-6 text-sm font-semibold px-5 py-2.5 rounded-[7px] text-white" style={{ backgroundColor: '#d64b55' }}>
            Nuova comunicazione
          </button>
        </div>
      )}

      {/* ── Log invii ── */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Storico invii</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{log.oggetto}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {TIPOLOGIE.find(t => t.value === log.tipologia)?.label ?? log.tipologia}
                    {log.progetti && ` · ${(log.progetti as { school_name: string }).school_name}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-gray-700">{log.n_inviati} inviati</div>
                  {log.n_errori > 0 && <div className="text-xs text-orange-500">{log.n_errori} errori</div>}
                  <div className="text-xs text-gray-300 mt-0.5">
                    {new Date(log.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
