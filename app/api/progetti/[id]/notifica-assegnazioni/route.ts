import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAssegnazioneRaggruppataEmail, sendEmail } from '@/lib/email'
import { randomUUID } from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: progettoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { corso_ids } = await request.json() as { corso_ids: string[] }
  if (!corso_ids?.length) return NextResponse.json({ error: 'Nessun corso selezionato' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch full corso data for selected courses
  const { data: corsi, error: corsiErr } = await admin
    .from('corsi')
    .select('id, title, tipo, ore_totali, modalita, pre_assegnazione, formatore_id, project_id, referente_corso_nome, referente_corso_email')
    .in('id', corso_ids)
    .not('formatore_id', 'is', null)

  if (corsiErr) return NextResponse.json({ error: corsiErr.message }, { status: 500 })
  if (!corsi?.length) return NextResponse.json({ error: 'Nessun corso valido' }, { status: 400 })

  // Fetch project
  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name, ref_name, ref_email')
    .eq('id', progettoId)
    .single()
  if (!progetto) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })

  // Group courses by formatore_id
  const byFormatore = new Map<string, typeof corsi>()
  for (const c of corsi) {
    const key = c.formatore_id as string
    if (!byFormatore.has(key)) byFormatore.set(key, [])
    byFormatore.get(key)!.push(c)
  }

  const now = new Date().toISOString()
  const sentCount: number[] = []

  for (const [formatoreId, fCorsi] of byFormatore) {
    const { data: formatore } = await admin
      .from('profiles')
      .select('nome, email')
      .eq('id', formatoreId)
      .single()

    if (!formatore?.email) continue

    // Generate one shared token for this formatore batch
    const token = randomUUID()
    const tokenUrl = `${APP_URL}/assegnazioni/${token}`
    const isPreBatch = fCorsi.every(c => c.pre_assegnazione)

    const emailBody = await generateAssegnazioneRaggruppataEmail({
      formatore_nome: formatore.nome,
      corsi: fCorsi.map(c => ({
        title: c.title,
        tipo: c.tipo,
        ore_totali: c.ore_totali,
        modalita: c.modalita,
        pre_assegnazione: !!c.pre_assegnazione,
      })),
      school_name: progetto.school_name,
      token_url: tokenUrl,
      is_pre_assegnazione: isPreBatch,
    })

    const subject = isPreBatch
      ? `Pre-assegnazione corsi — ${progetto.school_name}`
      : `Nuove assegnazioni corsi — ${progetto.school_name}`

    try {
      await sendEmail({
        to: formatore.email,
        subject,
        body: emailBody,
        actions: [{ label: isPreBatch ? '→ Gestisci le tue pre-assegnazioni' : '→ Gestisci le tue assegnazioni', url: tokenUrl, primary: true }],
      })
    } catch (err) {
      console.error('[notifica-assegnazioni] sendEmail error:', err)
      continue
    }

    // Update all courses in this batch
    await admin
      .from('corsi')
      .update({
        notificato: true,
        token_assegnazione: token,
        accettazione_richiesta_at: now,
      })
      .in('id', fCorsi.map(c => c.id))

    // Log in solleciti_log for each course (so cron doesn't re-send)
    for (const c of fCorsi) {
      try {
        await admin.from('solleciti_log').insert({
          corso_id: c.id,
          formatore_id: formatoreId,
          tipo: 'assegnazione',
        })
      } catch { /* non-critical */ }
    }

    sentCount.push(fCorsi.length)
  }

  return NextResponse.json({ sent: sentCount.reduce((a, b) => a + b, 0) })
}
