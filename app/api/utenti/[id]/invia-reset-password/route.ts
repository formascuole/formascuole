import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(callerProfile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: targetProfile } = await admin.from('profiles').select('nome, email').eq('id', id).single()
  if (!targetProfile) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })

  // Genera un link di recovery via admin API (non dipende dalla scadenza standard OTP)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: targetProfile.email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkError?.message || 'Errore generazione link' }, { status: 500 })
  }

  const resetLink = linkData.properties.action_link

  await sendEmail({
    to: targetProfile.email,
    subject: 'Reimposta la tua password — Formascuole',
    body: `
      <p>Ciao ${targetProfile.nome},</p>
      <p>Hai richiesto di reimpostare la password per accedere alla piattaforma Formascuole.</p>
      <p>Clicca sul pulsante qui sotto per creare una nuova password. Il link è valido per <strong>24 ore</strong>.</p>
      <p style="margin-top:8px;font-size:12px;color:#888;">Se non hai richiesto questa email, puoi ignorarla.</p>
    `,
    actions: [{ label: 'Reimposta password', url: resetLink, primary: true }],
  })

  return NextResponse.json({ success: true })
}
