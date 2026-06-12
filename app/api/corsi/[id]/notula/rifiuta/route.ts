import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse('Token mancante', { status: 400 })

  const admin = createAdminClient()
  const { data: corso } = await admin.from('corsi').select('notula_token, notula_stato, notula_numero, title').eq('id', corsoId).single()
  if (!corso || corso.notula_token !== token) return new NextResponse('Token non valido', { status: 401 })
  if (corso.notula_stato !== 'inviata') {
    return new NextResponse(rifiutaPage(corsoId, token, 'Già processata', 'disabled'), { headers: { 'Content-Type': 'text/html' } })
  }
  return new NextResponse(rifiutaPage(corsoId, token), { headers: { 'Content-Type': 'text/html' } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const formData = await request.formData()
  const token = formData.get('token') as string
  const motivazione = (formData.get('motivazione') as string)?.trim()

  if (!token || !motivazione) {
    return new NextResponse(rifiutaPage(corsoId, token ?? '', 'La motivazione è obbligatoria'), { headers: { 'Content-Type': 'text/html' } })
  }

  const admin = createAdminClient()
  const { data: corso } = await admin.from('corsi').select('*, project:progetti!project_id(school_name)').eq('id', corsoId).single()
  if (!corso || corso.notula_token !== token) return new NextResponse('Token non valido', { status: 401 })

  await admin.from('corsi').update({
    notula_stato: 'rifiutata',
    notula_risposta_at: new Date().toISOString(),
    notula_motivazione_rifiuto: motivazione,
  }).eq('id', corsoId)

  if (corso.formatore_id) {
    const { data: formatore } = await admin.from('profiles').select('nome, email').eq('id', corso.formatore_id).single()
    if (formatore?.email) {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.formascuole.it'
      const corsoLink = `${base}/progetti/${corso.project_id}/corsi/${corsoId}`
      const schoolName = (corso as Record<string, unknown> & { project?: { school_name?: string } }).project?.school_name ?? '—'
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Formascuole <noreply@formascuole.it>',
        to: formatore.email,
        subject: `Notula rifiutata — ${corso.title} — ${schoolName}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="margin-bottom:20px;"><span style="font-size:20px;font-weight:bold;color:#d64b55;">Formascuole</span></div>
          <p>Gentile <strong>${formatore.nome}</strong>,</p>
          <p>la tua notula n. <strong>${corso.notula_numero}</strong> per il corso <strong>${corso.title}</strong> non è stata accettata per il seguente motivo:</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;color:#991b1b;">${motivazione}</div>
          <p>Ti chiediamo di correggere e reinviare la notula. <a href="${corsoLink}" style="color:#2563eb;">Accedi alla piattaforma</a> per generare una nuova versione.</p>
          <p style="color:#6b7280;font-size:13px;">Cordiali saluti,<br/>Il team Formascuole</p>
        </div>`,
        text: `Gentile ${formatore.nome}, la notula n. ${corso.notula_numero} per ${corso.title} è stata rifiutata. Motivo: ${motivazione}`,
      })
    }
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rifiuto registrato</title></head>
    <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
      <div style="background:white;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="font-size:48px;margin-bottom:16px;">&#10003;</div>
        <h1 style="color:#dc2626;font-size:20px;margin:0 0 12px;">Rifiuto registrato</h1>
        <p style="color:#6b7280;margin:0;">Il formatore è stato notificato via email con la motivazione del rifiuto.</p>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

function rifiutaPage(corsoId: string, token: string, error = '', disabled = '') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rifiuto notula</title></head>
    <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
      <div style="background:white;border-radius:12px;padding:40px;max-width:480px;width:100%;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <h1 style="color:#dc2626;font-size:20px;margin:0 0 8px;">Rifiuto notula</h1>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Inserisci la motivazione del rifiuto. Il formatore la riceverà via email.</p>
        ${error ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;color:#991b1b;font-size:14px;">${error}</div>` : ''}
        <form method="POST">
          <input type="hidden" name="token" value="${token}"/>
          <textarea name="motivazione" required ${disabled} placeholder="Descrivi il motivo del rifiuto..." style="width:100%;min-height:120px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;margin-bottom:16px;"></textarea>
          <button type="submit" ${disabled} style="width:100%;padding:12px;background:#dc2626;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Conferma rifiuto</button>
        </form>
      </div>
    </body></html>`
}
