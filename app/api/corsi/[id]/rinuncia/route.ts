import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(callerProfile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as {
    motivo?: string
    note?: string
    invia_email?: boolean
  }

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, project_id, formatore_id, lettera_incarico_url, lettera_incarico_firmata, stato_assegnazione')
    .eq('id', id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (!corso.formatore_id) return NextResponse.json({ error: 'Nessun formatore assegnato' }, { status: 400 })
  if (corso.stato_assegnazione !== 'accettato')
    return NextResponse.json({ error: 'Il formatore non ha ancora accettato' }, { status: 400 })

  const { data: formatore } = await admin
    .from('profiles')
    .select('id, nome, email')
    .eq('id', corso.formatore_id as string)
    .single()

  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name')
    .eq('id', corso.project_id as string)
    .single()

  const now = new Date().toISOString()

  const updatePayload: Record<string, unknown> = {
    rinuncia_motivo: body.motivo ?? null,
    rinuncia_note: body.note ?? null,
    rinuncia_at: now,
    rinuncia_formatore_id: corso.formatore_id,
    rinuncia_formatore_nome: formatore?.nome ?? null,
    // Reset assegnazione
    formatore_id: null,
    stato_assegnazione: 'non_assegnato',
    accettazione_richiesta_at: null,
    accettazione_risposta_at: null,
    rifiuto_motivazione: null,
    token_assegnazione: null,
    pre_assegnazione: false,
  }

  // Annulla lettera d'incarico se presente e non firmata
  if (corso.lettera_incarico_url && !corso.lettera_incarico_firmata) {
    updatePayload.lettera_incarico_annullata = true
    updatePayload.lettera_incarico_annullata_at = now
    updatePayload.lettera_incarico_annullata_motivo = body.motivo ?? null
    updatePayload.lettera_incarico_url_storico = corso.lettera_incarico_url
    updatePayload.lettera_incarico_url = null
    updatePayload.lettera_incarico_pending = false
    updatePayload.lettera_incarico_firmata = false
    updatePayload.lettera_incarico_firmata_at = null
    updatePayload.lettera_incarico_ip = null
    updatePayload.lettera_incarico_inviata_at = null
    updatePayload.lettera_incarico_sollecito_at = null
  }

  const { error } = await admin.from('corsi').update(updatePayload).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.invia_email && formatore && progetto) {
    try {
      const motivoLabel = body.motivo ?? ''
      const emailBody = `Gentile ${formatore.nome},

ti informiamo che è stata registrata una rinuncia all'incarico di formatore per il seguente corso:

Corso: ${corso.title}
Scuola: ${progetto.school_name}${motivoLabel ? `\nMotivo: ${motivoLabel}` : ''}${body.note ? `\nNote: ${body.note}` : ''}

La lettera d'incarico precedentemente generata è stata annullata.

Per qualsiasi chiarimento ti invitiamo a contattare il team Formascuole.

Cordiali saluti,
Il team Formascuole`

      await sendEmail({
        to: formatore.email,
        subject: `Registrazione rinuncia — ${corso.title}`,
        body: emailBody,
      })
    } catch (err) {
      console.error('[rinuncia] Email send failed (non-fatal):', err)
    }
  }

  return NextResponse.json({ success: true })
}
