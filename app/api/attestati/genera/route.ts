import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAttestatoPdf } from '@/lib/generate-attestato-pdf'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) return null
  return user
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { corso_id, attestato_nome, attestato_cognome, attestato_email } = body

  if (!corso_id || !attestato_nome?.trim() || !attestato_cognome?.trim() || !attestato_email?.trim()) {
    return NextResponse.json({ error: 'corso_id, attestato_nome, attestato_cognome e attestato_email sono obbligatori' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('title, ore_totali')
    .eq('id', corso_id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  const { data: lastSession } = await admin
    .from('sessioni')
    .select('data')
    .eq('corso_id', corso_id)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()

  const dataUltimaSessione = lastSession?.data
    ? new Date(lastSession.data + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const nome_cognome = `${attestato_nome.trim()} ${attestato_cognome.trim()}`

  const pdfBuffer = await generateAttestatoPdf({
    nome_cognome,
    titolo_corso: corso.title,
    ore_totali: corso.ore_totali,
    data: dataUltimaSessione,
  })

  // Upload to storage
  const uuid = crypto.randomUUID()
  const storagePath = `${corso_id}/${uuid}.pdf`

  const { error: uploadError } = await admin.storage
    .from('attestati')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf' })

  if (uploadError) {
    console.error('[attestati] Storage upload error:', uploadError)
    return NextResponse.json({ error: 'Errore durante il salvataggio del PDF' }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('attestati').getPublicUrl(storagePath)

  const { data: attestato, error: dbError } = await admin
    .from('attestati')
    .insert({ corso_id, nome_cognome, email: attestato_email.trim(), pdf_url: publicUrl })
    .select()
    .single()

  if (dbError) {
    console.error('[attestati] DB insert error:', dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Send email with PDF attachment
  const emailBody = `Gentile ${nome_cognome},

in allegato trovi l'attestato di partecipazione per il corso:

📚 ${corso.title}
⏱ ${corso.ore_totali} ore di formazione

Cordiali saluti,
Il team Formascuole`

  await resend.emails.send({
    from: 'Formascuole <noreply@formascuole.it>',
    to: attestato_email.trim(),
    subject: `Il tuo attestato di partecipazione — ${corso.title}`,
    text: emailBody,
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="margin-bottom:24px;"><span style="font-size:20px;font-weight:bold;color:#d64b55;">Formascuole</span></div>
      <div style="white-space:pre-wrap;color:#1a1a1a;line-height:1.6;">${emailBody.replace(/\n/g, '<br/>')}</div>
      <div style="margin-top:24px;">
        <a href="${publicUrl}" style="display:inline-block;padding:10px 22px;background:#d64b55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Scarica PDF</a>
      </div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
        <p>Formascuole — Piattaforma gestione progetti formativi</p>
        <p><a href="${APP_URL}" style="color:#d64b55;">${APP_URL}</a></p>
      </div>
    </div>`,
    attachments: [{
      filename: `attestato-${nome_cognome.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      content: pdfBuffer.toString('base64'),
    }],
  }).catch(err => console.error('[attestati] Email error:', err))

  return NextResponse.json({ success: true, attestato })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const corsoId = new URL(req.url).searchParams.get('corso_id')

  let q = admin
    .from('attestati')
    .select('*, corso:corsi(title)')
    .order('created_at', { ascending: false })

  if (corsoId) q = (q as typeof q).eq('corso_id', corsoId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
