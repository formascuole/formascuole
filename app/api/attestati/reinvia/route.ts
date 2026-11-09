import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { attestato_id } = await req.json()
  if (!attestato_id) return NextResponse.json({ error: 'attestato_id mancante' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch attestato + corso
  const { data: attestato, error: attErr } = await admin
    .from('attestati')
    .select('id, nome_cognome, email, pdf_url, corso:corsi(title)')
    .eq('id', attestato_id)
    .single()

  if (attErr || !attestato) {
    return NextResponse.json({ error: 'Attestato non trovato' }, { status: 404 })
  }
  if (!attestato.pdf_url) {
    return NextResponse.json({ error: 'PDF non disponibile' }, { status: 400 })
  }

  // Download PDF from storage
  const pdfResp = await fetch(attestato.pdf_url)
  if (!pdfResp.ok) {
    return NextResponse.json({ error: 'Impossibile scaricare il PDF dallo storage' }, { status: 500 })
  }
  const pdfBuffer = await pdfResp.arrayBuffer()

  const titoloCors = (attestato.corso as { title?: string } | null)?.title || 'corso'

  const { error: emailError } = await resend.emails.send({
    from: 'Formascuole <noreply@formascuole.it>',
    to: attestato.email,
    subject: `Il tuo attestato di partecipazione — ${titoloCors}`,
    text: `Gentile ${attestato.nome_cognome},\n\nin allegato trovi l'attestato di partecipazione per il corso:\n\n📚 ${titoloCors}\n\nCordiali saluti,\nIl team Formascuole`,
    attachments: [
      {
        filename: `attestato-${attestato.nome_cognome.replace(/\s+/g, '-').toLowerCase()}.pdf`,
        content: Buffer.from(pdfBuffer),
      },
    ],
  })

  if (emailError) {
    console.error('[attestati/reinvia] email error:', emailError)
    return NextResponse.json({ error: emailError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
