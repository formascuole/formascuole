import { createAdminClient } from '@/lib/supabase/admin'
import { MaterialiPublicClient } from './MaterialiPublicClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MaterialiPublicPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, tipo, modalita, token_materiali, materiali_scadenza, project_id')
    .eq('token_materiali', token)
    .maybeSingle()

  if (!corso) notFound()

  // Check expiry
  const today = new Date().toISOString().slice(0, 10)
  if (corso.materiali_scadenza && today > corso.materiali_scadenza) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center" style={{ border: '0.5px solid #e5e5e5' }}>
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Portale non più disponibile</h1>
          <p className="text-sm text-gray-500">
            L&apos;accesso ai materiali del corso <strong>{corso.title}</strong> è scaduto il{' '}
            {new Date(corso.materiali_scadenza + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}.
          </p>
        </div>
      </div>
    )
  }

  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name')
    .eq('id', corso.project_id)
    .single()

  const { data: sessioni } = await admin
    .from('sessioni')
    .select('id, data, ora_inizio, ora_fine, ore, tipo_sessione, link_videoconferenza, completata')
    .eq('corso_id', corso.id)
    .order('data')

  const { data: materiali } = await admin
    .from('materiali_corso')
    .select('*')
    .eq('corso_id', corso.id)
    .order('ordine')
    .order('created_at')

  return (
    <MaterialiPublicClient
      corsoId={corso.id}
      titoloCorso={corso.title}
      schoolName={progetto?.school_name ?? ''}
      scadenza={corso.materiali_scadenza ?? null}
      sessioni={(sessioni ?? []) as Array<{
        id: string
        data: string
        ora_inizio: string | null
        ora_fine: string | null
        ore: number
        tipo_sessione: string | null
        link_videoconferenza: string | null
        completata: boolean
      }>}
      materiali={(materiali ?? []) as Array<{
        id: string
        nome: string
        descrizione: string | null
        tipo: 'file' | 'link'
        url: string
        ordine: number
      }>}
    />
  )
}
