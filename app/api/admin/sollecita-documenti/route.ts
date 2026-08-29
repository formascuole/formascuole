import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: utenti } = await admin
    .from('profiles')
    .select('id, nome, email, cv_url, ci_url')
    .in('role', ['formatore', 'tutor'])
    .eq('documenti_completi', false)

  if (!utenti || utenti.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  for (const u of utenti) {
    const mancanti: string[] = []
    if (!u.cv_url) mancanti.push('Curriculum Vitae (CV)')
    if (!u.ci_url) mancanti.push("Documento d'identità")
    if (mancanti.length === 0) continue

    const body = `Ciao ${u.nome},\n\nPer completare il tuo profilo su Formascuole devi caricare i seguenti documenti:\n\n${mancanti.map(m => `• ${m}`).join('\n')}\n\nAccedi al tuo profilo per effettuare l'upload.`

    await sendEmail({
      to: u.email,
      subject: 'Formascuole — Documenti obbligatori mancanti',
      body,
      actions: [{ label: 'Carica i documenti', url: `${process.env.NEXT_PUBLIC_SITE_URL}/account`, primary: true }],
    })
    sent++
  }

  return NextResponse.json({ sent })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('role', ['formatore', 'tutor'])
    .eq('documenti_completi', false)

  return NextResponse.json({ count: count ?? 0 })
}
