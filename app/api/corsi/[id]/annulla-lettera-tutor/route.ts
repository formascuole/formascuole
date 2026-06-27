import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLetteraAnnullataEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(callerProfile?.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { motivo } = await request.json().catch(() => ({ motivo: null })) as { motivo?: string | null }

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, project_id, tutor_id, lettera_tutor_url, lettera_tutor_firmata')
    .eq('id', id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (!corso.lettera_tutor_url) return NextResponse.json({ error: 'Nessuna lettera da annullare' }, { status: 400 })
  if (corso.lettera_tutor_firmata) return NextResponse.json({ error: 'La lettera è già stata firmata' }, { status: 400 })

  const { error } = await admin
    .from('corsi')
    .update({
      lettera_tutor_url: null,
      lettera_tutor_pending: false,
      lettera_tutor_firmata: false,
      lettera_tutor_firmata_at: null,
      lettera_tutor_ip: null,
      lettera_tutor_inviata_at: null,
      lettera_tutor_sollecito_at: null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (corso.tutor_id) {
    try {
      const [{ data: tutor }, { data: progetto }] = await Promise.all([
        admin.from('profiles').select('nome, email').eq('id', corso.tutor_id as string).single(),
        admin.from('progetti').select('school_name').eq('id', corso.project_id as string).single(),
      ])
      if (tutor && progetto) {
        await sendLetteraAnnullataEmail({
          to: tutor.email as string,
          persona_nome: tutor.nome as string,
          corso_title: corso.title as string,
          school_name: progetto.school_name as string,
          tipo: 'tutor',
          motivo,
        })
      }
    } catch (err) {
      console.error('[annulla-lettera-tutor] Email send failed (non-fatal):', err)
    }
  }

  return NextResponse.json({ success: true })
}
