import { AssegnazioniClient } from './AssegnazioniClient'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export default async function AssegnazioniPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let data: Record<string, unknown> | null = null
  let fetchError = false

  try {
    const res = await fetch(`${APP_URL}/api/assegnazioni/${token}`, { cache: 'no-store' })
    if (res.status === 404) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="text-red-600">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Link non valido</h1>
            <p className="text-sm text-gray-500">Il link che hai seguito non è valido o è già stato rimosso.</p>
          </div>
        </div>
      )
    }
    if (res.ok) data = await res.json()
    else fetchError = true
  } catch {
    fetchError = true
  }

  if (fetchError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-sm border border-gray-100">
          <h1 className="text-lg font-bold text-gray-900 mb-2">Errore</h1>
          <p className="text-sm text-gray-500">Impossibile caricare le assegnazioni. Riprova più tardi.</p>
        </div>
      </div>
    )
  }

  if (data.scaduto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="text-amber-600">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Link scaduto</h1>
          <p className="text-sm text-gray-500">
            Questo link era valido per 48 ore e non è più utilizzabile. Contatta il coordinatore per ricevere un nuovo link.
          </p>
          {!!data.scadenzaAt && (
            <p className="text-xs text-gray-400 mt-3">
              Scaduto il{' '}
              {new Date(data.scadenzaAt as string).toLocaleString('it-IT', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <AssegnazioniClient
      corsi={data.corsi as never[]}
      progetto={data.progetto as never}
      token={token}
      scadenzaAt={data.scadenzaAt as string | null}
    />
  )
}
