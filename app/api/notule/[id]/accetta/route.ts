import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

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

  if (!token) return htmlPage('Link non valido', 'Il link non contiene un token valido.', '#dc2626')

  const admin = createAdminClient()

  const { data: notula } = await admin
    .from('notule')
    .select('id, numero, stato, token, formatore_id, importo_totale, netto, tipo')
    .eq('id', id)
    .single()

  if (!notula) return htmlPage('Notula non trovata', 'La notula richiesta non esiste.', '#dc2626')
  if (!notula.token || notula.token !== token) {
    return htmlPage('Link non valido', 'Il token non è valido o è scaduto.', '#dc2626')
  }
  if (notula.stato === 'accettata') {
    return htmlPage('Già accettata', 'Questa notula è già stata accettata. Grazie!', '#16a34a')
  }
  if (notula.stato !== 'inviata') {
    return htmlPage('Operazione non valida', 'Questa notula non può essere accettata nello stato attuale.', '#dc2626')
  }

  // Update notula
  await admin.from('notule').update({
    stato: 'accettata',
    risposta_at: new Date().toISOString(),
    token: null,
  }).eq('id', id)

  // Send confirmation email to formatore
  const { data: formatore } = await admin
    .from('profiles')
    .select('nome, email, regime_fiscale')
    .eq('id', notula.formatore_id)
    .single()

  if (formatore?.email) {
    const netto = Number(notula.netto ?? 0)
    const marcaDaBollo = formatore.regime_fiscale === 'notula' && Number(notula.importo_totale ?? 0) > 77.47

    const body = `Gentile ${formatore.nome},

la tua notula n. ${notula.numero} è stata accettata.

Netto da ricevere: € ${netto.toFixed(2)}
${marcaDaBollo ? `
⚠️ MARCA DA BOLLO:
Se l'importo della notula supera € 77,47 è obbligatorio apporre una marca da bollo da € 2,00 sull'originale cartaceo.
La marca da bollo deve essere annullata con data e firma prima dell'invio dell'originale a:
SVC Consulting S.r.l.
Via A. Vallisneri 7 – 00197 Roma
` : ''}
Il pagamento sarà effettuato nei tempi previsti tramite bonifico bancario.

Grazie,
Il team Formascuole`

    sendEmail({
      to: formatore.email,
      subject: `Notula accettata — n. ${notula.numero}`,
      body,
    }).catch(console.error)
  }

  return htmlPage(
    'Notula accettata!',
    `La notula n. <strong>${notula.numero}</strong> è stata accettata con successo. Una email di conferma è stata inviata al formatore.`,
    '#16a34a'
  )
}
