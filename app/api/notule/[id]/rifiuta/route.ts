import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

function htmlPage(title: string, message: string, color: string, extra = '') {
  return new NextResponse(
    `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style>
      body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
      .card{max-width:480px;width:100%;padding:40px 32px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;}
      .icon{font-size:48px;margin-bottom:16px;}
      h1{font-size:22px;font-weight:700;color:${color};margin:0 0 12px;}
      p{color:#555;line-height:1.6;margin:0 0 16px;}
      textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;resize:vertical;min-height:100px;font-family:inherit;}
      button{margin-top:12px;padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;}
      button:hover{background:#b91c1c;}
    </style>
    </head><body><div class="card"><div class="icon">${color === '#dc2626' && !extra ? '❌' : '📝'}</div><h1>${title}</h1><p>${message}</p>${extra}</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')

  if (!token) return htmlPage('Link non valido', 'Il link non contiene un token valido.', '#dc2626')

  const admin = createAdminClient()

  const { data: notula } = await admin
    .from('notule')
    .select('id, numero, stato, token')
    .eq('id', id)
    .single()

  if (!notula) return htmlPage('Notula non trovata', 'La notula richiesta non esiste.', '#dc2626')
  if (!notula.token || notula.token !== token) {
    return htmlPage('Link non valido', 'Il token non è valido o è scaduto.', '#dc2626')
  }
  if (notula.stato === 'rifiutata') {
    return htmlPage('Già rifiutata', 'Questa notula è già stata rifiutata.', '#6b7280')
  }
  if (notula.stato !== 'inviata') {
    return htmlPage('Operazione non valida', 'Questa notula non può essere rifiutata nello stato attuale.', '#dc2626')
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.formascuole.it'
  const formHtml = `
    <form method="POST" action="${APP_URL}/api/notule/${id}/rifiuta?token=${token}">
      <textarea name="motivazione" placeholder="Motivo del rifiuto (obbligatorio)" required></textarea>
      <button type="submit">Conferma rifiuto</button>
    </form>`

  return htmlPage(
    `Rifiuta notula n. ${notula.numero}`,
    'Indica il motivo del rifiuto. Verrà inviata una email al formatore.',
    '#d97706',
    formHtml
  )
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')

  if (!token) return htmlPage('Link non valido', 'Il link non contiene un token valido.', '#dc2626')

  const admin = createAdminClient()

  const { data: notula } = await admin
    .from('notule')
    .select('id, numero, stato, token, formatore_id')
    .eq('id', id)
    .single()

  if (!notula) return htmlPage('Notula non trovata', 'La notula richiesta non esiste.', '#dc2626')
  if (!notula.token || notula.token !== token) {
    return htmlPage('Link non valido', 'Il token non è valido o è scaduto.', '#dc2626')
  }
  if (notula.stato !== 'inviata') {
    return htmlPage('Operazione non valida', 'Questa notula non può essere rifiutata nello stato attuale.', '#dc2626')
  }

  // Parse motivazione from FormData
  const formData = await request.formData()
  const motivazione = (formData.get('motivazione') as string)?.trim()
  if (!motivazione) {
    return htmlPage('Motivazione obbligatoria', 'Devi inserire un motivo del rifiuto.', '#dc2626')
  }

  // Update notula
  await admin.from('notule').update({
    stato: 'rifiutata',
    risposta_at: new Date().toISOString(),
    motivazione_rifiuto: motivazione,
    token: null,
  }).eq('id', id)

  // Send email to formatore
  const { data: formatore } = await admin
    .from('profiles')
    .select('nome, email')
    .eq('id', notula.formatore_id)
    .single()

  if (formatore?.email) {
    const body = `Gentile ${formatore.nome},

la tua notula n. ${notula.numero} è stata rifiutata.

Motivazione: ${motivazione}

Accedi alla piattaforma per visualizzare i dettagli o generare una nuova notula.

Grazie,
Il team Formascuole`

    sendEmail({
      to: formatore.email,
      subject: `Notula rifiutata — n. ${notula.numero}`,
      body,
    }).catch(console.error)
  }

  return htmlPage(
    'Notula rifiutata',
    `La notula n. <strong>${notula.numero}</strong> è stata rifiutata. Una email è stata inviata al formatore con la motivazione indicata.`,
    '#16a34a'
  )
}
