'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Password reset state
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('msg') === 'password-aggiornata') {
      setSuccessMsg('Password aggiornata con successo! Puoi ora accedere.')
    }
    if (params.get('error')) {
      setError(decodeURIComponent(params.get('error')!))
    }
  }, [])

  const handleResetPassword = async () => {
    if (!resetEmail) return
    setResetLoading(true)
    setResetError('')
    const supabase = createClient()
    const { data: resetData, error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://formascuole.vercel.app/auth/callback?next=/reset-password',
    })
    console.log('reset email result:', { data: resetData, error: resetErr })
    setResetLoading(false)
    if (resetErr) {
      setResetError(`Errore nell'invio: ${resetErr.message}. Contatta formazione@formascuole.it`)
    } else {
      setResetSent(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      setError('Email o password non validi.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const dest = profile?.role === 'admin' ? '/dashboard' : '/formatore'
    // Hard navigation ensures session cookies are sent with the next request,
    // avoiding the race condition between router.push and middleware cookie checks.
    window.location.href = dest
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-5">
            <img
              src="https://www.formascuole.it/wp-content/uploads/2024/01/logo-formascuole-black-red-flag-2048x361.png"
              alt="Formascuole"
              style={{ height: '40px', width: 'auto', maxWidth: '220px', objectFit: 'contain' }}
              onError={(e) => {
                const img = e.currentTarget
                img.style.display = 'none'
                const fallback = img.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'block'
              }}
            />
            <span
              className="text-2xl font-bold text-gray-900"
              style={{ display: 'none' }}
            >
              Formascuole
            </span>
          </div>
          <p className="text-sm text-gray-500">Accedi alla piattaforma</p>
        </div>

        {/* Form */}
        <div
          className="bg-white rounded-xl p-6 shadow-sm"
          style={{ border: '0.5px solid #e5e5e5' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="nome@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => { setShowReset(v => !v); setResetSent(false); setResetError('') }}
                  className="text-xs text-gray-400 hover:text-[#d64b55] transition-colors"
                >
                  Hai dimenticato la password?
                </button>
              </div>
            </div>

            {/* Password reset panel */}
            {showReset && (
              <div className="rounded-[7px] border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  Riceverai un&apos;email con il link per reimpostare la password.
                </p>
                {resetSent ? (
                  <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-[7px] px-3 py-2">
                    Email inviata! Controlla la tua casella di posta (anche la cartella spam).
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      label=""
                      type="email"
                      placeholder="Inserisci la tua email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      autoComplete="email"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleResetPassword() } }}
                    />
                    {resetError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
                        {resetError}
                      </div>
                    )}
                    <Button type="button" onClick={handleResetPassword} loading={resetLoading} size="sm" className="w-full">
                      Invia link di reset
                    </Button>
                  </div>
                )}
              </div>
            )}

            {successMsg && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-[7px] px-3 py-2">
                {successMsg}
              </div>
            )}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Accedi
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Formascuole — Tutti i diritti riservati
        </p>
      </div>
    </div>
  )
}
