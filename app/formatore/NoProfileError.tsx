'use client'
import { createClient } from '@/lib/supabase/client'

export function NoProfileError() {
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5] px-4">
      <div
        className="bg-white rounded-xl p-8 max-w-md w-full text-center"
        style={{ border: '0.5px solid #e5e5e5' }}
      >
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#d97706"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Profilo non trovato</h2>
        <p className="text-sm text-gray-500 mb-6">
          Il tuo account esiste ma il profilo non è ancora stato configurato.
          Contatta un amministratore per completare la configurazione.
        </p>
        <button
          onClick={handleLogout}
          className="text-sm font-medium hover:underline"
          style={{ color: '#d64b55' }}
        >
          Esci dall&apos;account
        </button>
      </div>
    </div>
  )
}
