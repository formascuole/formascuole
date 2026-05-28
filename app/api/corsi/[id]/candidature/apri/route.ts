import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCandidaturaDisponibileEmail, sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('title, tipo, ore_totali, formatore_id, project_id')
    .eq('id', corsoId)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (corso.formatore_id) return NextResponse.json({ error: 'Il corso ha già un formatore assegnato' }, { status: 400 })

  await admin.from('corsi').update({
    candidature_aperte: true,
    candidature_aperte_at: new Date().toISOString(),
  }).eq('id', corsoId)

  const { data: progetto } = await admin
    .from('progetti').select('school_name').eq('id', corso.project_id).single()

  const { data: formatori } = await admin
    .from('profiles').select('nome, email').eq('role', 'formatore')

  const corsoUrl = `${APP_URL}/formatore`

  const formatori_list = formatori || []
  console.log(`[candidature/apri] Invio email a ${formatori_list.length} formatori per corso "${corso.title}"`)

  // Await all emails before responding — fire-and-forget is killed by serverless on return
  await Promise.allSettled(
    formatori_list.map(async (f) => {
      try {
        const body = await generateCandidaturaDisponibileEmail({
          formatore_nome: f.nome,
          corso_title: corso.title,
          tipo: corso.tipo || '',
          school_name: progetto?.school_name || '',
          ore_totali: corso.ore_totali,
          corso_url: corsoUrl,
        })
        await sendEmail({
          to: f.email,
          subject: `Nuovo corso disponibile — ${corso.title}`,
          body,
          actions: [{ label: 'Candidati ora', url: corsoUrl, primary: true }],
        })
        console.log(`[candidature/apri] Email inviata a ${f.email}`)
      } catch (err) {
        console.error(`[candidature/apri] Errore invio email a ${f.email}:`, err)
      }
    })
  )

  console.log(`[candidature/apri] Completato — ${formatori_list.length} email processate`)

  return NextResponse.json({ success: true })
}
