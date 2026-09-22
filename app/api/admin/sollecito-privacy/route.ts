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
    .select('id, nome, email')
    .in('role', ['formatore', 'tutor'])
    .eq('privacy_accettata', false)

  if (!utenti || utenti.length === 0) return NextResponse.json({ sent: 0 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'
  let sent = 0
  for (const u of utenti) {
    const body = `Gentile ${u.nome},

per poter continuare ad accedere alla piattaforma Formascuole è necessario leggere e accettare la nostra informativa sulla privacy (GDPR).

Accedi alla piattaforma e completa il passaggio richiesto.

Cordiali saluti,
Il team Formascuole`

    await sendEmail({
      to: u.email,
      subject: 'Azione richiesta: accettazione privacy policy — Formascuole',
      body,
      actions: [{ label: 'Accetta la privacy policy', url: `${appUrl}/onboarding/privacy`, primary: true }],
    })
    sent++
  }

  return NextResponse.json({ sent })
}
