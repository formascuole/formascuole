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
    .select('id, title, project_id, formatore_id, lettera_incarico_url, lettera_incarico_firmata')
    .eq('id', id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (!corso.lettera_incarico_url) return NextResponse.json({ error: 'Nessuna lettera da annullare' }, { status: 400 })
  if (corso.lettera_incarico_firmata) return NextResponse.json({ error: 'La lettera è già stata firmata' }, { status: 400 })

  const { error } = await admin
    .from('corsi')
    .update({
      lettera_incarico_url: null,
      lettera_incarico_pending: false,
      lettera_incarico_firmata: false,
      lettera_incarico_firmata_at: null,
      lettera_incarico_ip: null,
      lettera_incarico_inviata_at: null,
      lettera_incarico_sollecito_at: null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (corso.formatore_id) {
    try {
      const [{ data: formatore }, { data: progetto }] = await Promise.all([
        admin.from('profiles').select('nome, email').eq('id', corso.formatore_id as string).single(),
        admin.from('progetti').select('school_name').eq('id', corso.project_id as string).single(),
      ])
      if (formatore && progetto) {
        await sendLetteraAnnullataEmail({
          to: formatore.email as string,
          persona_nome: formatore.nome as string,
          corso_title: corso.title as string,
          school_name: progetto.school_name as string,
          tipo: 'formatore',
          motivo,
        })
      }
    } catch (err) {
      console.error('[annulla-lettera] Email send failed (non-fatal):', err)
    }
  }

  return NextResponse.json({ success: true })
}
