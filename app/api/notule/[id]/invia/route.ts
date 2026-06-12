import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { randomUUID } from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.formascuole.it'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch notula with corsi
  const { data: notula } = await admin
    .from('notule')
    .select('*, corsi:notule_corsi(corso_id, importo, ore_erogate, corso:corsi(id, title, project_id))')
    .eq('id', id)
    .single()

  if (!notula) return NextResponse.json({ error: 'Notula non trovata' }, { status: 404 })

  // Check permission: must be the formatore or an admin
  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(callerProfile?.role ?? '')
  if (!isAdmin && notula.formatore_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (notula.stato !== 'bozza') {
    return NextResponse.json({ error: 'La notula non è in stato bozza' }, { status: 400 })
  }

  // Generate token
  const token = randomUUID()

  const accettaUrl = `${APP_URL}/api/notule/${id}/accetta?token=${token}`
  const rifiutaUrl = `${APP_URL}/api/notule/${id}/rifiuta?token=${token}`

  // Get formatore name
  const { data: formatore } = await admin
    .from('profiles')
    .select('nome, email')
    .eq('id', notula.formatore_id)
    .single()

  const corsiList = (notula.corsi || [])
    .map((nc: { corso: { title: string } | null }) => nc.corso?.title ?? '—')
    .join(', ')

  const subject = `Notula n. ${notula.numero} — ${formatore?.nome ?? 'Formatore'}`
  const body = `Notula ricevuta da ${formatore?.nome ?? 'un formatore'}.

Numero: ${notula.numero}
Tipo: ${notula.tipo === 'cumulativa' ? 'Cumulativa' : 'Singola'}
Corsi: ${corsiList}
Importo totale: € ${Number(notula.importo_totale ?? 0).toFixed(2)}
Netto: € ${Number(notula.netto ?? 0).toFixed(2)}
${notula.pdf_url ? `\nPDF: ${notula.pdf_url}` : ''}

Per procedere, usa i link sottostanti:`

  // Send email to amministrazione
  await sendEmail({
    to: 'amministrazione@formascuole.it',
    subject,
    body,
    actions: [
      { label: 'ACCETTA', url: accettaUrl, primary: true },
      { label: 'RIFIUTA', url: rifiutaUrl },
    ],
  })

  // Update notula
  await admin.from('notule').update({
    stato: 'inviata',
    inviata_at: new Date().toISOString(),
    token,
  }).eq('id', id)

  return NextResponse.json({ ok: true })
}
