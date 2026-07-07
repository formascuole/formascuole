import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { url, qrDataUrl } = body as { url: string; qrDataUrl?: string }

  if (!url) return NextResponse.json({ error: 'URL mancante' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch corso + project
  const { data: corso } = await admin
    .from('corsi')
    .select('title, formatore_id, project_id')
    .eq('id', corsoId)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (!corso.formatore_id) return NextResponse.json({ error: 'Nessun formatore assegnato' }, { status: 400 })

  const [{ data: formatore }, { data: progetto }] = await Promise.all([
    admin.from('profiles').select('nome, email').eq('id', corso.formatore_id).single(),
    admin.from('progetti').select('school_name').eq('id', corso.project_id).single(),
  ])

  if (!formatore?.email) return NextResponse.json({ error: 'Email formatore non trovata' }, { status: 400 })

  const scuola = progetto?.school_name || '—'

  const textBody = `Gentile ${formatore.nome},

di seguito il link al questionario di valutazione da condividere con i partecipanti al termine del corso.

Corso: ${corso.title}
Scuola: ${scuola}

Link questionario: ${url}

Il link precompila automaticamente i dati del corso — i partecipanti devono solo compilare le domande.

Grazie,
Il team Formascuole`

  const qrHtml = qrDataUrl
    ? `<div style="margin-top:24px;text-align:center;">
        <p style="font-size:13px;color:#6b7280;margin-bottom:8px;">Oppure scansiona il QR code:</p>
        <img src="${qrDataUrl}" width="180" height="180" alt="QR Code questionario" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;" />
      </div>`
    : ''

  const htmlBody = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:20px;font-weight:bold;color:#d64b55;">Formascuole</span>
    </div>
    <div style="white-space:pre-wrap;color:#1a1a1a;line-height:1.6;">${textBody.replace(/\n/g, '<br/>')}</div>
    <div style="margin-top:20px;">
      <a href="${url}" style="display:inline-block;padding:10px 22px;background-color:#d64b55;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
        Apri questionario
      </a>
    </div>
    ${qrHtml}
  </div>`

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: 'Formascuole <noreply@formascuole.it>',
    to: formatore.email,
    subject: `Questionario valutazione — ${corso.title} — ${scuola}`,
    text: textBody,
    html: htmlBody,
  })

  return NextResponse.json({ success: true })
}

// Called when admin opens the modal — checks date constraint, then increments counter
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check: must not be before the last scheduled session date
  const { data: sessioni } = await admin
    .from('sessioni')
    .select('data')
    .eq('corso_id', corsoId)
    .order('data', { ascending: false })
    .limit(1)

  if (!sessioni || sessioni.length === 0) {
    return NextResponse.json({ error: 'Aggiungi almeno una sessione prima di generare il questionario' }, { status: 403 })
  }

  const ultimaData = sessioni[0].data as string
  const todayDate = new Date().toISOString().split('T')[0]
  if (todayDate < ultimaData) {
    return NextResponse.json({ error: `Il questionario è disponibile dal ${ultimaData}` }, { status: 403 })
  }

  const { data: currentCorso } = await admin.from('corsi').select('questionario_generato_count').eq('id', corsoId).single()
  await admin.from('corsi').update({
    questionario_generato_at: new Date().toISOString(),
    questionario_generato_count: ((currentCorso?.questionario_generato_count as number | null) ?? 0) + 1,
  }).eq('id', corsoId)

  return NextResponse.json({ success: true })
}
