import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAssegnazioneRaggruppataEmail, sendEmail } from '@/lib/email'
import { randomUUID } from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch all pending corsi with active/pending projects
  const { data: corsiRaw, error } = await admin
    .from('corsi')
    .select('id, title, tipo, ore_totali, modalita, pre_assegnazione, formatore_id, project_id, referente_corso_nome, referente_corso_email')
    .not('formatore_id', 'is', null)
    .eq('stato_assegnazione', 'in_attesa')
    .eq('notificato', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!corsiRaw?.length) return NextResponse.json({ notificati: 0, formatori: 0, progetti: 0 })

  // Filter to active/pending projects
  const projectIds = [...new Set(corsiRaw.map(c => c.project_id as string))]
  const { data: progettiRaw } = await admin
    .from('progetti')
    .select('id, school_name, ref_name, ref_email, status')
    .in('id', projectIds)
    .in('status', ['active', 'pending'])

  const progettiMap = new Map((progettiRaw || []).map(p => [p.id as string, p]))
  const corsi = corsiRaw.filter(c => progettiMap.has(c.project_id as string))
  if (!corsi.length) return NextResponse.json({ notificati: 0, formatori: 0, progetti: 0 })

  // Group by project_id → formatore_id
  const byProject = new Map<string, Map<string, typeof corsi>>()
  for (const c of corsi) {
    const pid = c.project_id as string
    if (!byProject.has(pid)) byProject.set(pid, new Map())
    const byF = byProject.get(pid)!
    const fid = c.formatore_id as string
    if (!byF.has(fid)) byF.set(fid, [])
    byF.get(fid)!.push(c)
  }

  const now = new Date().toISOString()
  let totalNotificati = 0
  const formatoreSentIds = new Set<string>()
  const progettotiSentIds = new Set<string>()

  for (const [progettoId, byFormatore] of byProject) {
    const progetto = progettiMap.get(progettoId)
    if (!progetto) continue

    for (const [formatoreId, fCorsi] of byFormatore) {
      const { data: formatore } = await admin
        .from('profiles')
        .select('nome, email')
        .eq('id', formatoreId)
        .single()

      if (!formatore?.email) continue

      const token = randomUUID()
      const isPreBatch = fCorsi.every(c => c.pre_assegnazione)
      const tokenUrl = isPreBatch ? `${APP_URL}/pre-assegnazioni/${token}` : `${APP_URL}/assegnazioni/${token}`

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
        console.error('[invia-notifiche-pending] sendEmail error:', err)
        continue
      }

      await admin
        .from('corsi')
        .update({ notificato: true, token_assegnazione: token, accettazione_richiesta_at: now })
        .in('id', fCorsi.map(c => c.id))

      for (const c of fCorsi) {
        try {
          await admin.from('solleciti_log').insert({ corso_id: c.id, formatore_id: formatoreId, tipo: 'assegnazione' })
        } catch { /* non-critical */ }
      }

      totalNotificati += fCorsi.length
      formatoreSentIds.add(formatoreId)
      progettotiSentIds.add(progettoId)
    }
  }

  return NextResponse.json({
    notificati: totalNotificati,
    formatori: formatoreSentIds.size,
    progetti: progettotiSentIds.size,
  })
}
