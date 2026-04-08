import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import RifiutaForm from './RifiutaForm'

export default async function RifiutaCorsoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, formatore_id, project_id, stato_assegnazione, ore_totali')
    .eq('id', corsoId)
    .single()

  if (!corso || corso.formatore_id !== user.id) redirect('/formatore')
  if (corso.stato_assegnazione !== 'in_attesa') redirect('/formatore')

  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name')
    .eq('id', corso.project_id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm max-w-md w-full p-8" style={{ border: '0.5px solid #e5e5e5' }}>
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="#991b1b" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 text-center mb-2">Rifiuta incarico</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Specifica il motivo del rifiuto. Il corso verrà rimesso disponibile.
        </p>

        <div className="bg-gray-50 rounded-[10px] p-4 mb-6 space-y-2">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Corso</div>
            <div className="font-semibold text-gray-900">{corso.title}</div>
          </div>
          {progetto && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Scuola</div>
              <div className="text-sm text-gray-700">{progetto.school_name}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Ore totali</div>
            <div className="text-sm text-gray-700">{corso.ore_totali}h</div>
          </div>
        </div>

        <RifiutaForm corsoId={corsoId} />

        <div className="mt-4 text-center">
          <Link href="/formatore" className="text-xs text-gray-400 hover:text-gray-600">
            Torna alla dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
