import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse('Token mancante', { status: 400 })

  const admin = createAdminClient()
  const { data: corso } = await admin.from('corsi').select('*, project:progetti!project_id(school_name)').eq('id', corsoId).single()
  if (!corso || corso.notula_token !== token) return new NextResponse('Token non valido', { status: 401 })
  if (corso.notula_stato !== 'inviata') {
    return new NextResponse(htmlPage('Già processata', `La notula è già in stato: ${corso.notula_stato}`), {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  await admin.from('corsi').update({
    notula_stato: 'accettata',
    notula_risposta_at: new Date().toISOString(),
  }).eq('id', corsoId)

  // Fetch formatore email
  if (corso.formatore_id) {
    const { data: formatore } = await admin.from('profiles').select('nome, email').eq('id', corso.formatore_id).single()
    if (formatore?.email) {
      // Fetch sessioni to compute imponibile for bollo check
      const { data: sessioni } = await admin.from('sessioni').select('ore').eq('corso_id', corsoId).eq('completata', true)
      const oreErogate = (sessioni || []).reduce((s: number, r: { ore: number }) => s + Number(r.ore), 0)
      const tariffa = (corso.tariffa_oraria as number | null) ?? 0
      const imponibile = oreErogate * tariffa

      const formatoreProfilo = await admin.from('profiles').select('regime_fiscale').eq('id', corso.formatore_id).single()
      const regimeFormatore = formatoreProfilo.data?.regime_fiscale ?? 'notula'

      const bolloHtml = regimeFormatore === 'notula' && imponibile > 77.47
        ? `<div style="background:#fffbeb;border:1px solid #d97706;border-radius:8px;padding:16px;margin:16px 0;">
            <strong>IMPORTANTE — Marca da bollo</strong><br/>
            Prima di inviare l'originale cartaceo applica una marca da bollo da € 2,00 e annullala con data e firma.<br/>
            La copia digitale è esente dall'obbligo di bollo.
           </div>
           <p>Invia l'originale cartaceo a:<br/><strong>SVC Consulting Srl, Via Antonio Vallisneri 7, 00197 Roma</strong></p>`
        : ''
      const schoolName = (corso as Record<string, unknown> & { project?: { school_name?: string } }).project?.school_name ?? '—'
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Formascuole <noreply@formascuole.it>',
        to: formatore.email,
        subject: `Notula accettata — ${corso.title} — ${schoolName}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="margin-bottom:20px;"><span style="font-size:20px;font-weight:bold;color:#d64b55;">Formascuole</span></div>
          <p>Gentile <strong>${formatore.nome}</strong>,</p>
          <p>la tua notula n. <strong>${corso.notula_numero}</strong> per il corso <strong>${corso.title}</strong> è stata <strong style="color:#16a34a;">accettata</strong>.</p>
          ${bolloHtml}
          <p style="color:#6b7280;font-size:13px;">Cordiali saluti,<br/>Il team Formascuole</p>
        </div>`,
        text: `Gentile ${formatore.nome}, la tua notula n. ${corso.notula_numero} per il corso ${corso.title} è stata accettata.`,
      })
    }
  }

  return new NextResponse(htmlPage('Notula accettata', 'La notula è stata accettata. Il formatore è stato notificato via email.', '#16a34a'), {
    headers: { 'Content-Type': 'text/html' }
  })
}

function htmlPage(title: string, msg: string, color = '#111') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head>
    <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
      <div style="background:white;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="font-size:48px;margin-bottom:16px;">${color === '#16a34a' ? '&#10003;' : '&#9888;'}</div>
        <h1 style="color:${color};font-size:20px;margin:0 0 12px;">${title}</h1>
        <p style="color:#6b7280;margin:0;">${msg}</p>
      </div>
    </body></html>`
}
