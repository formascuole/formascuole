import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function stripHtml(s: unknown): string | null {
  if (s == null || s === '') return null
  return String(s).replace(/<[^>]*>/g, '').trim() || null
}

function toMedia(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseFloat(String(v))
  return isNaN(n) ? null : n
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
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
  return NextResponse.json({ success: true, id: data.id })
}
