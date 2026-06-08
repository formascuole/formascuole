import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInvioCalendarioEmail, sendEmail } from '@/lib/email'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(profile?.role)

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi_con_ore')
    .select('id, title, project_id, formatore_id, referente_id, referente_corso_nome, referente_corso_email, calendario_completo')
    .eq('id', id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  // Admin or the assigned formatore can send the calendar
  if (!isAdmin && corso.formatore_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!corso.calendario_completo) {
    return NextResponse.json({ error: 'Il calendario non è ancora completo' }, { status: 400 })
  }

  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name, ref_name, ref_email')
    .eq('id', corso.project_id)
    .single()

  if (!progetto) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })

  // Determine destination email priority: referente_corso_email > corso referente > progetto ref
  let toEmail: string | null = corso.referente_corso_email || null
  let toNome: string = corso.referente_corso_nome || progetto.ref_name

  if (!toEmail && corso.referente_id) {
    const { data: referente } = await admin
      .from('referenti_progetto')
      .select('nome, email')
      .eq('id', corso.referente_id)
      .single()
    if (referente) {
      toEmail = referente.email
      if (!toNome) toNome = referente.nome
    }
  }

  if (!toEmail) toEmail = progetto.ref_email
  if (!toNome) toNome = progetto.ref_name

  const { data: sessioni } = await admin
    .from('sessioni')
    .select('data, ora_inizio, ora_fine, ore')
    .eq('corso_id', id)
    .order('data')

  let formatore_nome: string | null = null
  if (corso.formatore_id) {
    const { data: fmt } = await admin.from('profiles').select('nome').eq('id', corso.formatore_id).single()
    formatore_nome = fmt?.nome || null
  }

  const { subject, body, htmlBody } = generateInvioCalendarioEmail({
    corso_title: corso.title,
    school_name: progetto.school_name,
    referente_nome: toNome,
    formatore_nome,
    sessioni: sessioni || [],
  })

  if (!toEmail) return NextResponse.json({ error: 'Nessun indirizzo email disponibile per la scuola' }, { status: 400 })

  await sendEmail({ to: toEmail, subject, body, htmlBody })

  await admin
    .from('corsi')
    .update({ calendario_inviato_at: new Date().toISOString() })
    .eq('id', id)

  await admin.from('solleciti_log').insert({
    corso_id: id,
    formatore_id: corso.formatore_id || user.id,
    tipo: 'calendario_inviato_scuola',
  })

  return NextResponse.json({ success: true })
}
