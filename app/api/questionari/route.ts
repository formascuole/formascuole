import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAttestatoPdf } from '@/lib/generate-attestato-pdf'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

async function fireAndForgetAttestato(params: {
  corso_id: string
  attestato_nome: string
  attestato_cognome: string
  attestato_email: string
}) {
  try {
    const admin = createAdminClient()

    const { data: corso } = await admin
      .from('corsi')
      .select('title, ore_totali')
      .eq('id', params.corso_id)
      .single()

    if (!corso) return

    const { data: lastSession } = await admin
      .from('sessioni')
      .select('data')
      .eq('corso_id', params.corso_id)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle()

    const dataUltimaSessione = lastSession?.data
      ? new Date(lastSession.data + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const nome_cognome = `${params.attestato_nome.trim()} ${params.attestato_cognome.trim()}`

    const pdfBuffer = await generateAttestatoPdf({
      nome_cognome,
      titolo_corso: corso.title,
      ore_totali: corso.ore_totali,
      data: dataUltimaSessione,
    })

    const uuid = crypto.randomUUID()
    const storagePath = `${params.corso_id}/${uuid}.pdf`

    const { error: uploadError } = await admin.storage
      .from('attestati')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf' })

    if (uploadError) {
      console.error('[attestati/questionario] Upload error:', uploadError)
      return
    }

    const { data: { publicUrl } } = admin.storage.from('attestati').getPublicUrl(storagePath)

    await admin
      .from('attestati')
      .insert({ corso_id: params.corso_id, nome_cognome, email: params.attestato_email.trim(), pdf_url: publicUrl })

    const emailBody = `Gentile ${nome_cognome},

in allegato trovi l'attestato di partecipazione per il corso:

📚 ${corso.title}
⏱ ${corso.ore_totali} ore di formazione

Cordiali saluti,
Il team Formascuole`

    await resend.emails.send({
      from: 'Formascuole <noreply@formascuole.it>',
      to: params.attestato_email.trim(),
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
    })
  } catch (err) {
    console.error('[attestati/questionario] Error:', err)
  }
}

function stripHtml(s: unknown): string | null {
  if (s == null || s === '') return null
  return String(s).replace(/<[^>]*>/g, '').trim() || null
}

function toMedia(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

async function parseBody(request: NextRequest): Promise<Record<string, unknown>> {
  const ct = request.headers.get('content-type') ?? ''
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text()
    const params = new URLSearchParams(text)
    const obj: Record<string, unknown> = {}
    params.forEach((value, key) => { obj[key] = value })
    return obj
  }
  return request.json()
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await parseBody(request)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  console.log('[questionari/webhook] received fields:', JSON.stringify(body, null, 2))

  const {
    corso_id,
    scuola,
    titolo_corso,
    tipo_corso,
    formatore,
    nome_formatore,
    regione,
    provincia,
    linea_finanziamento,
    data_somministrazione,
    media_formatore,
    media_contenuti,
    media_apprendimento,
    impatto_applicare,
    testo_strumenti,
    testo_suggerimenti,
    riassunto_ai,
    numero_risposte,
    vuole_attestato,
    attestato_nome,
    attestato_cognome,
    attestato_email,
  } = body

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('questionari_risultati')
    .insert({
      corso_id: corso_id || null,
      scuola: scuola || null,
      titolo_corso: titolo_corso || null,
      tipo_corso: tipo_corso || null,
      formatore: formatore || nome_formatore || null,
      regione: regione || null,
      provincia: provincia || null,
      linea_finanziamento: linea_finanziamento || null,
      data_somministrazione: data_somministrazione || null,
      media_formatore: toMedia(media_formatore),
      media_contenuti: toMedia(media_contenuti),
      media_apprendimento: toMedia(media_apprendimento),
      impatto_applicare: impatto_applicare || null,
      testo_strumenti: stripHtml(testo_strumenti),
      testo_suggerimenti: stripHtml(testo_suggerimenti),
      riassunto_ai: stripHtml(riassunto_ai),
      numero_risposte: numero_risposte ? Number(numero_risposte) : 1,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[questionari/webhook] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[questionari/webhook] inserted id:', data.id)

  // Fire-and-forget attestato generation
  const wantsAttestato = String(vuole_attestato ?? '').toLowerCase().replace('ì', 'i') === 'si'
  if (wantsAttestato && corso_id && attestato_nome && attestato_cognome && attestato_email) {
    Promise.allSettled([
      fireAndForgetAttestato({
        corso_id: String(corso_id),
        attestato_nome: String(attestato_nome),
        attestato_cognome: String(attestato_cognome),
        attestato_email: String(attestato_email),
      }),
    ]).catch(() => {/* silent */})
  }

  return NextResponse.json({ success: true, id: data.id })
}
