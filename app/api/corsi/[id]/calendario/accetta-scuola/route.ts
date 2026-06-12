import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCalendarioConfermatoAdminEmail, generateCalendarioConfermatoScuolaEmail, sendEmail } from '@/lib/email'

function htmlPage(title: string, message: string, color: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
    .card{max-width:460px;width:100%;padding:40px 32px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;}
    .icon{font-size:48px;margin-bottom:16px;} h1{font-size:22px;font-weight:700;color:${color};margin:0 0 12px;} p{color:#555;line-height:1.6;margin:0;}</style>
    </head><body><div class="card"><div class="icon">✅</div><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')

  if (!token) return htmlPage('Link non valido', 'Il link utilizzato non contiene un token valido.', '#dc2626')

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, project_id, formatore_id, calendario_token, calendario_confermato, referente_id, referente_corso_nome, referente_corso_email')
    .eq('id', id)
    .single()

  if (!corso) return htmlPage('Corso non trovato', 'Il corso richiesto non esiste.', '#dc2626')
  if (!corso.calendario_token || corso.calendario_token !== token) {
    return htmlPage('Link non valido', 'Il token non è valido o è scaduto. Richiedere un nuovo invio del calendario.', '#dc2626')
  }
  if (corso.calendario_confermato) {
    return htmlPage('Già confermato', 'Il calendario di questo corso è già stato confermato in precedenza. Grazie!', '#16a34a')
  }

  // Mark confirmed
  await admin.from('corsi').update({
    calendario_confermato: true,
    calendario_confermato_at: new Date().toISOString(),
    calendario_token: null,
  }).eq('id', id)

  // Fetch support data in parallel
  const [{ data: progetto }, { data: sessioni }] = await Promise.all([
    admin.from('progetti').select('school_name, ref_name, ref_email').eq('id', corso.project_id).single(),
    admin.from('sessioni').select('data, ora_inizio, ora_fine, ore').eq('corso_id', id).order('data'),
  ])

  let formatore_nome: string | null = null
  let formatore_email: string | null = null
  let formatore_tel: string | null = null
  if (corso.formatore_id) {
    const { data: fmt } = await admin.from('profiles').select('nome, email, telefono').eq('id', corso.formatore_id).single()
    formatore_nome = fmt?.nome || null
    formatore_email = fmt?.email || null
    formatore_tel = fmt?.telefono || null
  }

  const corsoUrl = `${process.env.NEXT_PUBLIC_APP_URL}/progetti/${corso.project_id}/corsi/${id}`

  if (progetto) {
    // Email to pianificazione@formascuole.it
    const { subject: adminSubject, body: adminBody } = generateCalendarioConfermatoAdminEmail({
      corso_title: corso.title,
      school_name: progetto.school_name,
      formatore_nome,
      corso_url: corsoUrl,
    })
    sendEmail({
      to: 'pianificazione@formascuole.it',
      subject: adminSubject,
      body: adminBody,
      actions: [{ label: 'Vedi corso', url: corsoUrl, primary: true }],
    }).catch(console.error)

    // Confirmation email to school
    let toEmail: string | null = corso.referente_corso_email || null
    let toNome: string = corso.referente_corso_nome || progetto.ref_name

    if (!toEmail && corso.referente_id) {
      const { data: referente } = await admin.from('referenti_progetto').select('nome, email').eq('id', corso.referente_id).single()
      if (referente) {
        toEmail = referente.email
        if (!toNome) toNome = referente.nome
      }
    }
    if (!toEmail) toEmail = progetto.ref_email

    if (toEmail) {
      const { subject, body, htmlBody } = generateCalendarioConfermatoScuolaEmail({
        corso_title: corso.title,
        school_name: progetto.school_name,
        referente_nome: toNome,
        formatore_nome,
        formatore_email,
        formatore_tel,
        sessioni: sessioni || [],
      })
      sendEmail({ to: toEmail, subject, body, htmlBody }).catch(console.error)
    }
  }

  return htmlPage(
    'Calendario confermato!',
    `Grazie! La conferma del calendario per il corso <strong>"${corso.title}"</strong>${progetto ? ` presso <strong>${progetto.school_name}</strong>` : ''} è stata registrata con successo.<br><br>Una email di riepilogo è stata inviata al vostro indirizzo.`,
    '#16a34a'
  )
}
