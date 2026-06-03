'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ProfileData {
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
}

interface OnboardingClientProps {
  nome: string
  email: string
  initialStep: 1 | 2
  profile: ProfileData
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
  const [form, setForm] = useState<ProfileData>(profile)
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
    'luogo_nascita', 'data_nascita', 'codice_fiscale',
    'indirizzo_via', 'indirizzo_cap', 'indirizzo_citta', 'indirizzo_provincia',
    'iban', 'banca', 'intestatario_conto',
  ]
  const allFilled = requiredStep2Fields.every(f => form[f].trim().length > 0)
  const noErrors = !cfError && !ibanError && !provinciaError && !capError
  const canStep2 = allFilled && noErrors

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
