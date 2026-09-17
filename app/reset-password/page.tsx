'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Verify there is an active recovery session (set by /auth/callback)
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      } else {
        setError('Il link è scaduto o non valido. Richiedi un nuovo link di reset dalla pagina di login.')
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== conferma) {
      setError('Le password non coincidono.')
      return
    }
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError, data } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Errore nell\'aggiornamento della password. Riprova o contatta formazione@formascuole.it')
      setLoading(false)
      return
    }
    // Mark password_cambiata = true in profiles
    if (data.user) {
      await supabase.from('profiles').update({ password_cambiata: true }).eq('id', data.user.id)
    }
    router.push('/login?msg=password-aggiornata')
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
            <span className="text-2xl font-bold text-gray-900" style={{ display: 'none' }}>
              Formascuole
            </span>
          </div>
          <p className="text-sm text-gray-500">Reimposta la tua password</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm" style={{ border: '0.5px solid #e5e5e5' }}>
          {!ready ? (
            <div className="space-y-4">
              {error ? (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
                  {error}
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-4">Verifica in corso…</div>
              )}
              {error && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push('/login')}
                >
                  Torna al login
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nuova password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Input
                label="Conferma nuova password"
                type="password"
                placeholder="••••••••"
                value={conferma}
                onChange={(e) => setConferma(e.target.value)}
                required
                autoComplete="new-password"
              />
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[7px] px-3 py-2">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
                Aggiorna password
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Formascuole — Tutti i diritti riservati
        </p>
      </div>
    </div>
  )
}
