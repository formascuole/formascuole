import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const {
    corso_id,
    scuola,
    titolo_corso,
    tipo_corso,
    formatore,
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
      formatore: formatore || null,
      regione: regione || null,
      provincia: provincia || null,
      linea_finanziamento: linea_finanziamento || null,
      data_somministrazione: data_somministrazione || null,
      media_formatore: media_formatore != null ? Number(media_formatore) : null,
      media_contenuti: media_contenuti != null ? Number(media_contenuti) : null,
      media_apprendimento: media_apprendimento != null ? Number(media_apprendimento) : null,
      impatto_applicare: impatto_applicare || null,
      testo_strumenti: testo_strumenti || null,
      testo_suggerimenti: testo_suggerimenti || null,
      riassunto_ai: riassunto_ai || null,
      numero_risposte: numero_risposte ? Number(numero_risposte) : 1,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[questionari/webhook] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
