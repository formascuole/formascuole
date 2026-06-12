import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCalendarioConfermatoAdminEmail, generateCalendarioConfermatoScuolaEmail, sendEmail } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const confermato: boolean = !!body.confermato

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, project_id, formatore_id, referente_id, referente_corso_nome, referente_corso_email, calendario_inviato_at')
    .eq('id', id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  await admin.from('corsi').update({
    calendario_confermato: confermato,
    calendario_confermato_at: confermato ? new Date().toISOString() : null,
  }).eq('id', id)

  if (confermato) {
    const { data: progetto } = await admin
      .from('progetti')
      .select('school_name, ref_name, ref_email')
      .eq('id', corso.project_id)
      .single()

    const { data: sessioni } = await admin
      .from('sessioni')
      .select('data, ora_inizio, ora_fine, ore')
      .eq('corso_id', id)
      .order('data')

    let formatore_nome: string | null = null
    let formatore_email: string | null = null
    let formatore_tel: string | null = null
    if (corso.formatore_id) {
      const { data: fmt } = await admin.from('profiles').select('nome, email, telefono').eq('id', corso.formatore_id).single()
      formatore_nome = fmt?.nome || null
      formatore_email = fmt?.email || null
      formatore_tel = fmt?.telefono || null
    }

    const corsoUrl = `${process.env.NEXT_PUBLIC_APP_URL}/progetti/${corso.project_id}/corsi/${id}`

    if (progetto) {
      const { subject: adminSubject, body: adminBody } = generateCalendarioConfermatoAdminEmail({
        corso_title: corso.title,
        school_name: progetto.school_name,
        formatore_nome,
        corso_url: corsoUrl,
      })

      const { data: admins } = await admin.from('profiles').select('email').in('role', ['admin', 'super_admin'])
      await Promise.allSettled(
        (admins || []).map(a => sendEmail({ to: a.email, subject: adminSubject, body: adminBody, actions: [{ label: 'Vedi corso', url: corsoUrl, primary: true }] }))
      )

      // Send confirmation receipt to school
      let toEmail: string | null = corso.referente_corso_email || null
      let toNome: string = corso.referente_corso_nome || progetto.ref_name

      if (!toEmail && corso.referente_id) {
        const { data: referente } = await admin.from('referenti_progetto').select('nome, email').eq('id', corso.referente_id).single()
        if (referente) {
          toEmail = referente.email
          if (!toNome) toNome = referente.nome
        }
      }
      if (!toEmail) toEmail = progetto.ref_email

      if (toEmail) {
        const { subject: scuolaSubject, body: scuolaBody, htmlBody: scuolaHtmlBody } = generateCalendarioConfermatoScuolaEmail({
          corso_title: corso.title,
          school_name: progetto.school_name,
          referente_nome: toNome,
          formatore_nome,
          formatore_email,
          formatore_tel,
          sessioni: sessioni || [],
        })
        sendEmail({ to: toEmail, subject: scuolaSubject, body: scuolaBody, htmlBody: scuolaHtmlBody }).catch(console.error)
      }
    }
  }

  return NextResponse.json({ success: true })
}
