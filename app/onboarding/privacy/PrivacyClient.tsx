'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function PrivacyClient({ policyText }: { policyText: string }) {
  const [checked, setChecked] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setScrolled(true)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  async function handleAccept() {
    if (!checked || !scrolled) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/profilo/accetta-privacy', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Errore durante il salvataggio')
        return
      }
      router.push('/onboarding')
    } catch {
      setError('Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-2xl">
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#d64b55] text-white flex items-center justify-center text-sm font-bold">0</div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Passo 0 di 3</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-3">Informativa sulla privacy</h1>
          <p className="text-sm text-gray-500 mt-1">
            Leggi e accetta l&apos;informativa per continuare.
          </p>
        </div>

        <div className="p-8">
          <div
            ref={boxRef}
            className="h-72 overflow-y-auto border border-gray-200 rounded-xl p-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50"
          >
            {policyText}
          </div>

          {!scrolled && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Scorri fino in fondo per procedere
            </p>
          )}

          <label className={`flex items-start gap-3 mt-5 cursor-pointer select-none ${!scrolled ? 'opacity-40 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#d64b55] focus:ring-[#d64b55] cursor-pointer"
            />
            <span className="text-sm text-gray-700">
              Ho letto e accetto l&apos;informativa sul trattamento dei dati personali ai sensi del GDPR (Reg. UE 2016/679).
            </span>
          </label>

          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleAccept}
            disabled={!checked || !scrolled || loading}
            className="mt-6 w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: checked && scrolled ? '#d64b55' : '#e5e5e5', color: checked && scrolled ? '#fff' : '#999' }}
          >
            {loading ? 'Salvataggio…' : 'Accetto e continuo →'}
          </button>
        </div>
      </div>
    </div>
  )
}
