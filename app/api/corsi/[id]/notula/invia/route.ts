import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'
import { calcFinancials } from '@/lib/economia-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: corso } = await admin.from('corsi').select('*').eq('id', corsoId).single()
  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (!corso.formatore_id) return NextResponse.json({ error: 'Nessun formatore' }, { status: 400 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(callerProfile?.role)
  if (!isAdmin && corso.formatore_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['bozza', 'rifiutata'].includes(corso.notula_stato ?? '')) {
    return NextResponse.json({ error: 'Notula non in stato bozza o rifiutata' }, { status: 400 })
  }

  const token = randomUUID()

  const [{ data: formatore }, { data: progetto }, { data: sessioni }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', corso.formatore_id).single(),
    admin.from('progetti').select('school_name').eq('id', corso.project_id).single(),
    admin.from('sessioni').select('ore').eq('corso_id', corsoId).eq('completata', true),
  ])

  const oreErogate = (sessioni || []).reduce((s: number, r: { ore: number }) => s + Number(r.ore), 0)
  const tariffa = (corso.tariffa_oraria as number | null) ?? (formatore?.tariffa_oraria_formatore as number | null) ?? 0
  const regime = (formatore?.regime_fiscale ?? 'notula') as 'notula' | 'forfettario' | 'ordinario'
  const rivalsa = formatore?.rivalsa_iva ?? false
  const fin = calcFinancials(oreErogate, tariffa, regime, rivalsa)

  // Build approve/reject links
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.formascuole.it'
  const accettaUrl = `${base}/api/corsi/${corsoId}/notula/accetta?token=${token}`
  const rifiutaUrl = `${base}/api/corsi/${corsoId}/notula/rifiuta?token=${token}`

  let econLine = `Imponibile: € ${fin.imponibile.toFixed(2)}`
  if (regime === 'notula') econLine += `\nRitenuta d'acconto (20%): -€ ${Math.abs(fin.ritenuteIva).toFixed(2)}`
  else if (regime === 'ordinario' && rivalsa) econLine += `\nIVA (22%): +€ ${fin.ritenuteIva.toFixed(2)}`

  const htmlBody = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
    <div style="margin-bottom:20px;"><span style="font-size:20px;font-weight:bold;color:#d64b55;">Formascuole</span></div>
    <h2 style="font-size:16px;color:#111;margin:0 0 12px;">Notula da approvare</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px;">
      Il formatore <strong>${formatore?.nome ?? '—'}</strong> ha inviato la notula n. <strong>${corso.notula_numero}</strong>
      per il corso <strong>${corso.title}</strong> presso <strong>${progetto?.school_name ?? '—'}</strong>.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 20px;">
      <div style="font-size:14px;color:#374151;white-space:pre-line;">${econLine}
<strong>Netto: € ${fin.netto.toFixed(2)}</strong></div>
    </div>
    ${corso.notula_pdf_url ? `<p style="margin:0 0 20px;"><a href="${corso.notula_pdf_url}" style="color:#2563eb;">Visualizza il PDF</a></p>` : ''}
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <a href="${accettaUrl}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">ACCETTA</a>
      <a href="${rifiutaUrl}" style="display:inline-block;padding:12px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">RIFIUTA</a>
    </div>
  </div>`

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Formascuole <noreply@formascuole.it>',
    to: 'amministrazione@formascuole.it',
    subject: `Notula da approvare — ${formatore?.nome ?? '—'} — ${corso.title}`,
    html: htmlBody,
    text: `Notula n. ${corso.notula_numero} da ${formatore?.nome ?? '—'} per ${corso.title} presso ${progetto?.school_name ?? '—'}.\n${econLine}\nNetto: € ${fin.netto.toFixed(2)}\n\nACCETTA: ${accettaUrl}\nRIFIUTA: ${rifiutaUrl}`,
  })

  await admin.from('corsi').update({
    notula_stato: 'inviata',
    notula_inviata_at: new Date().toISOString(),
    notula_token: token,
  }).eq('id', corsoId)

  return NextResponse.json({ success: true })
}
