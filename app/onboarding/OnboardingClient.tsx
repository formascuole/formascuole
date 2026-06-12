'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { REGIONI } from '@/lib/geo-data'

interface ProfileData {
  telefono: string
  luogo_nascita: string
  data_nascita: string
  codice_fiscale: string
  indirizzo_via: string
  indirizzo_cap: string
  indirizzo_citta: string
  indirizzo_provincia: string
  iban: string
  banca: string
  intestatario_conto: string
  ha_partita_iva: boolean
  regime_fiscale: 'forfettario' | 'ordinario' | 'notula'
  rivalsa_iva: boolean
  partita_iva: string
  regione: string
}

interface OnboardingClientProps {
  nome: string
  email: string
  initialStep: 1 | 2
  profile: Omit<ProfileData, 'ha_partita_iva' | 'regime_fiscale' | 'rivalsa_iva' | 'partita_iva'>
  redirectTo: string
}

function validateCF(cf: string): boolean {
  return /^[A-Z]{6}[0-9]{2}[A-EHLMPRST][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i.test(cf.trim())
}

function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase()
  return /^IT[0-9]{2}[A-Z0-9]{23}$/.test(cleaned)
}

export function OnboardingClient({ nome, email, initialStep, profile, redirectTo }: OnboardingClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(initialStep)

  // Step 1 state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step1Loading, setStep1Loading] = useState(false)
  const [step1Error, setStep1Error] = useState('')

  // Step 2 state
  const [form, setForm] = useState<ProfileData>({
    ...profile,
    ha_partita_iva: false,
    regime_fiscale: 'notula',
    rivalsa_iva: false,
    partita_iva: '',
    regione: (profile as ProfileData).regione ?? '',
  })
  const [pivaSelected, setPivaSelected] = useState(false)
  const [step2Loading, setStep2Loading] = useState(false)
  const [step2Error, setStep2Error] = useState('')

  const pwdError = newPassword.length > 0 && newPassword.length < 8 ? 'Minimo 8 caratteri' : ''
  const confirmError = confirmPassword.length > 0 && newPassword !== confirmPassword ? 'Le password non corrispondono' : ''
  const canStep1 = newPassword.length >= 8 && newPassword === confirmPassword

  const cfError = form.codice_fiscale.length > 0 && !validateCF(form.codice_fiscale)
    ? 'Formato codice fiscale non valido (16 caratteri alfanumerici)'
    : ''
  const ibanError = form.iban.length > 0 && !validateIBAN(form.iban)
    ? 'Formato IBAN non valido (IT + 25 caratteri)'
    : ''
  const provinciaError = form.indirizzo_provincia.length > 0 && !/^[A-Z]{2}$/i.test(form.indirizzo_provincia)
    ? '2 lettere (es. MI, RM, NA)'
    : ''
  const capError = form.indirizzo_cap.length > 0 && !/^[0-9]{5}$/.test(form.indirizzo_cap)
    ? '5 cifre numeriche'
    : ''

  const requiredStep2Fields: (keyof ProfileData)[] = [
    'telefono', 'luogo_nascita', 'data_nascita', 'codice_fiscale',
    'indirizzo_via', 'indirizzo_cap', 'indirizzo_citta', 'indirizzo_provincia',
    'iban', 'banca', 'intestatario_conto',
  ]
  const allFilled = requiredStep2Fields.every(f => (form[f] as string).trim().length > 0)
  const pivaNumError = form.ha_partita_iva && pivaSelected && !/^\d{11}$/.test(form.partita_iva)
    ? 'Deve contenere esattamente 11 cifre numeriche'
    : ''
  const noErrors = !cfError && !ibanError && !provinciaError && !capError && !pivaNumError
  const canStep2 = allFilled && noErrors && pivaSelected && (!form.ha_partita_iva || /^\d{11}$/.test(form.partita_iva))

  const handleStep1 = async () => {
    setStep1Loading(true)
    setStep1Error('')
    try {
      const supabase = createClient()
      const { error: authErr } = await supabase.auth.updateUser({ password: newPassword })
      if (authErr) {
        setStep1Error(authErr.message)
        return
      }
      const res = await fetch('/api/onboarding/password', { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setStep1Error(j.error || 'Errore durante il salvataggio')
        return
      }
      setStep(2)
    } finally {
      setStep1Loading(false)
    }
  }

  const handleStep2 = async () => {
    setStep2Loading(true)
    setStep2Error('')
    try {
      const res = await fetch('/api/onboarding/profilo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setStep2Error(j.error || 'Errore durante il salvataggio')
        return
      }
      router.push(redirectTo)
    } finally {
      setStep2Loading(false)
    }
  }

  const setField = (key: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-start py-12 px-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#d64b55' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-xl font-bold text-gray-900">Formascuole</span>
      </div>

      {/* Progress */}
      <div className="w-full max-w-md mb-6">
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-[#d64b55]' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-[#d64b55]' : 'bg-gray-200'}`} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className={`text-xs font-medium ${step === 1 ? 'text-[#d64b55]' : 'text-gray-400'}`}>1 · Password</span>
          <span className={`text-xs font-medium ${step === 2 ? 'text-[#d64b55]' : 'text-gray-400'}`}>2 · Profilo</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8" style={{ border: '0.5px solid #e5e5e5' }}>
        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Benvenuto in Formascuole!</h1>
            <p className="text-sm text-gray-500 mb-6">
              Prima di iniziare devi cambiare la password temporanea.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nuova password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setStep1Error('') }}
                  placeholder="Minimo 8 caratteri"
                  autoComplete="new-password"
                  className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2.5 focus:outline-none focus:border-[#d64b55] transition-colors"
                />
                {pwdError && <p className="text-xs text-red-500 mt-1">{pwdError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Conferma password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setStep1Error('') }}
                  placeholder="Ripeti la nuova password"
                  autoComplete="new-password"
                  className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2.5 focus:outline-none focus:border-[#d64b55] transition-colors"
                />
                {confirmError && <p className="text-xs text-red-500 mt-1">{confirmError}</p>}
              </div>
              {step1Error && (
                <div className="bg-red-50 border border-red-200 rounded-[7px] px-3 py-2.5 text-sm text-red-700">
                  {step1Error}
                </div>
              )}
              <button
                onClick={handleStep1}
                disabled={!canStep1 || step1Loading}
                className="w-full py-2.5 rounded-[7px] text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#d64b55' }}
              >
                {step1Loading ? 'Salvataggio…' : 'Continua →'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Completa il tuo profilo</h1>
            <p className="text-sm text-gray-500 mb-6">
              Questi dati sono necessari per generare la tua notula di pagamento.
            </p>

            {/* Dati anagrafici */}
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dati anagrafici</h2>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={nome}
                  readOnly
                  className="w-full text-sm border border-gray-100 rounded-[7px] px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Telefono <span className="text-red-500">*</span>
                </label>
                <input type="tel" value={form.telefono} onChange={setField('telefono')}
                  placeholder="+39 333 1234567" className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Luogo di nascita <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.luogo_nascita} onChange={setField('luogo_nascita')}
                    placeholder="Es. Milano" className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Data di nascita <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={form.data_nascita} onChange={setField('data_nascita')}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Codice fiscale <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.codice_fiscale}
                  onChange={e => setForm(f => ({ ...f, codice_fiscale: e.target.value.toUpperCase() }))}
                  placeholder="Es. RSSMRC80A01H501Z" maxLength={16}
                  className={`w-full text-sm border rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors uppercase ${cfError ? 'border-red-300' : 'border-gray-200'}`} />
                {cfError && <p className="text-xs text-red-500 mt-1">{cfError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Via e civico <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.indirizzo_via} onChange={setField('indirizzo_via')}
                  placeholder="Es. Via Roma 12" className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    CAP <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.indirizzo_cap} onChange={setField('indirizzo_cap')}
                    placeholder="00100" maxLength={5}
                    className={`w-full text-sm border rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors ${capError ? 'border-red-300' : 'border-gray-200'}`} />
                  {capError && <p className="text-xs text-red-500 mt-1">{capError}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Città <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.indirizzo_citta} onChange={setField('indirizzo_citta')}
                    placeholder="Roma" className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Prov. <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.indirizzo_provincia}
                    onChange={e => setForm(f => ({ ...f, indirizzo_provincia: e.target.value.toUpperCase() }))}
                    placeholder="RM" maxLength={2}
                    className={`w-full text-sm border rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors uppercase ${provinciaError ? 'border-red-300' : 'border-gray-200'}`} />
                  {provinciaError && <p className="text-xs text-red-500 mt-1">{provinciaError}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Regione <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.regione}
                  onChange={e => setForm(f => ({ ...f, regione: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
                >
                  <option value="">Seleziona regione...</option>
                  {REGIONI.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Dati bancari */}
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dati bancari</h2>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  IBAN <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.iban}
                  onChange={e => setForm(f => ({ ...f, iban: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                  placeholder="IT60X0542811101000000123456" maxLength={27}
                  className={`w-full text-sm border rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors uppercase font-mono ${ibanError ? 'border-red-300' : 'border-gray-200'}`} />
                {ibanError && <p className="text-xs text-red-500 mt-1">{ibanError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Banca <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.banca} onChange={setField('banca')}
                  placeholder="Es. Banca Intesa Sanpaolo" className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Intestatario conto <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.intestatario_conto} onChange={setField('intestatario_conto')}
                  placeholder="Nome e cognome intestatario" className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors" />
              </div>
            </div>

            {/* Regime fiscale */}
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Regime fiscale</h2>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Hai una Partita IVA? <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPivaSelected(true)
                      setForm(f => ({ ...f, ha_partita_iva: true, regime_fiscale: f.regime_fiscale === 'notula' ? 'forfettario' : f.regime_fiscale }))
                    }}
                    className={`flex-1 py-2 rounded-[7px] text-sm font-medium border transition-colors ${form.ha_partita_iva && pivaSelected ? 'bg-[#d64b55] text-white border-[#d64b55]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                  >
                    Sì
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPivaSelected(true)
                      setForm(f => ({ ...f, ha_partita_iva: false, regime_fiscale: 'notula', rivalsa_iva: false }))
                    }}
                    className={`flex-1 py-2 rounded-[7px] text-sm font-medium border transition-colors ${!form.ha_partita_iva && pivaSelected ? 'bg-[#d64b55] text-white border-[#d64b55]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                  >
                    No
                  </button>
                </div>
              </div>
              {form.ha_partita_iva && pivaSelected && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Numero Partita IVA <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.partita_iva}
                    onChange={e => setForm(f => ({ ...f, partita_iva: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                    placeholder="12345678901"
                    maxLength={11}
                    className={`w-full text-sm border rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors font-mono ${pivaNumError ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  {pivaNumError && <p className="text-xs text-red-500 mt-1">{pivaNumError}</p>}
                </div>
              )}
              {form.ha_partita_iva && pivaSelected && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Regime fiscale <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.regime_fiscale === 'notula' ? 'forfettario' : form.regime_fiscale}
                    onChange={e => setForm(f => ({
                      ...f,
                      regime_fiscale: e.target.value as 'forfettario' | 'ordinario',
                      rivalsa_iva: e.target.value !== 'ordinario' ? false : f.rivalsa_iva,
                    }))}
                    className="w-full text-sm border border-gray-200 rounded-[7px] px-3 py-2 focus:outline-none focus:border-[#d64b55] transition-colors bg-white"
                  >
                    <option value="forfettario">Regime forfettario</option>
                    <option value="ordinario">Regime ordinario</option>
                  </select>
                </div>
              )}
              {form.ha_partita_iva && pivaSelected && form.regime_fiscale === 'ordinario' && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.rivalsa_iva}
                    onChange={e => setForm(f => ({ ...f, rivalsa_iva: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 accent-[#d64b55]"
                  />
                  <span className="text-sm text-gray-700">Applico rivalsa IVA 22%</span>
                </label>
              )}
              {!pivaSelected && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-[7px] px-3 py-2">
                  Seleziona se hai o meno una Partita IVA per procedere.
                </p>
              )}
            </div>

            {step2Error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2.5 text-sm text-red-700">
                {step2Error}
              </div>
            )}

            <button
              onClick={handleStep2}
              disabled={!canStep2 || step2Loading}
              className="w-full py-2.5 rounded-[7px] text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#d64b55' }}
            >
              {step2Loading ? 'Salvataggio…' : 'Salva e accedi alla piattaforma →'}
            </button>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Accesso per <span className="font-medium">{email}</span>
      </p>
    </div>
  )
}
