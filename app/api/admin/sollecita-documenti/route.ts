import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: utenti } = await admin
    .from('profiles')
    .select('id, nome, email, cv_url, ci_url, cf_url')
    .in('role', ['formatore', 'tutor'])
    .eq('documenti_completi', false)

  if (!utenti || utenti.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  for (const u of utenti) {
    const mancanti: { label: string; note?: string }[] = []
    if (!u.cv_url) mancanti.push({
      label: 'Curriculum Vitae in formato europeo',
      note: 'Template disponibile qui:\nhttps://formascuole24-my.sharepoint.com/:w:/g/personal/formazione_formascuole24_onmicrosoft_com/ESvxSxp9bGNMnsFpGMVevVMBxfkEjQI-HqdW2LqNgQNgEw?web=1&action=copy',
    })
    if (!u.ci_url) mancanti.push({ label: "Carta d'Identità", note: 'fronte e retro in un unico PDF' })
    if (!u.cf_url) mancanti.push({ label: 'Codice Fiscale', note: 'fronte e retro in un unico PDF' })
    if (mancanti.length === 0) continue

    const docLines = mancanti
      .map(m => m.note ? `✗ ${m.label}\n  ${m.note}` : `✗ ${m.label}`)
      .join('\n\n')

    const body = `Gentile ${u.nome},

per completare la registrazione sulla piattaforma Formascuole è necessario caricare i seguenti documenti accedendo alla sezione "Il mio account":

${docLines}

Tutti i documenti devono essere in formato PDF (max 2 MB).

I documenti sono necessari per la corretta gestione amministrativa degli incarichi e per la rendicontazione ministeriale.

Cordiali saluti,
Il team Formascuole`

    await sendEmail({
      to: u.email,
      subject: 'Documenti mancanti — Azione richiesta',
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
