import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateAssegnazioneEmail,
  generateCandidaturaRingraziamentoEmail,
  sendEmail,
} from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { formatore_id: string }
  if (!body.formatore_id) return NextResponse.json({ error: 'formatore_id richiesto' }, { status: 400 })

  const admin = createAdminClient()

  const [{ data: corso }, { data: progetto_raw }] = await Promise.all([
    admin.from('corsi').select('title, tipo, ore_totali, project_id').eq('id', corsoId).single(),
    admin.from('corsi').select('project_id').eq('id', corsoId).single(),
  ])

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  const { data: progetto } = await admin
    .from('progetti').select('school_name, ref_name, ref_email').eq('id', corso.project_id).single()

  // Update corso
  await admin.from('corsi').update({
    formatore_id: body.formatore_id,
    stato_assegnazione: 'in_attesa',
    candidature_aperte: false,
    accettazione_richiesta_at: new Date().toISOString(),
  }).eq('id', corsoId)

  // Update candidature stati
  await Promise.all([
    admin.from('candidature_corsi')
      .update({ stato: 'selezionato' })
      .eq('corso_id', corsoId)
      .eq('formatore_id', body.formatore_id),
    admin.from('candidature_corsi')
      .update({ stato: 'non_selezionato' })
      .eq('corso_id', corsoId)
      .neq('formatore_id', body.formatore_id),
  ])

  // Log assegnazione
  await admin.from('solleciti_log').insert({
    corso_id: corsoId,
    formatore_id: body.formatore_id,
    tipo: 'assegnazione',
  })

  // Fetch candidature for email sending
  const { data: candidature } = await admin
    .from('candidature_corsi')
    .select('formatore_id, stato, formatore:profiles!formatore_id(nome, email, avatar_initials)')
    .eq('corso_id', corsoId)

  // Fire-and-forget emails
  ;(async () => {
    for (const c of candidature || []) {
      const f = (c.formatore as unknown) as { nome: string; email: string } | null
      if (!f) continue

      if (c.formatore_id === body.formatore_id) {
        try {
          const emailBody = await generateAssegnazioneEmail({
            formatore_nome: f.nome,
            formatore_email: f.email,
            corso_title: corso.title,
            tipo: corso.tipo,
            school_name: progetto?.school_name || '',
            ore_totali: corso.ore_totali,
            ref_name: progetto?.ref_name || '',
            ref_email: progetto?.ref_email || '',
            accetta_url: `${APP_URL}/formatore`,
            rifiuta_url: `${APP_URL}/formatore`,
          })
          await sendEmail({
            to: f.email,
            subject: `Sei stato selezionato — ${corso.title} — ${progetto?.school_name}`,
            body: emailBody,
            actions: [
              { label: '✓ Accetta incarico', url: `${APP_URL}/formatore`, primary: true },
              { label: '✗ Rifiuta incarico', url: `${APP_URL}/formatore` },
            ],
          })
        } catch { /* ignore */ }
      } else {
        try {
          const emailBody = await generateCandidaturaRingraziamentoEmail({
            formatore_nome: f.nome,
            corso_title: corso.title,
            school_name: progetto?.school_name || '',
          })
          await sendEmail({
            to: f.email,
            subject: `Candidatura — ${corso.title}`,
            body: emailBody,
          })
        } catch { /* ignore */ }
      }
    }
  })()

  return NextResponse.json({ success: true })
}
