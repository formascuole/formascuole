import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmailConfermaPreAssegnazione, sendEmail } from '@/lib/email'

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
  if (!corso_ids?.length) return NextResponse.json({ success: true })

  const admin = createAdminClient()

  // Fetch corsi data before confirming, to send notification emails
  const { data: corsi, error: corsiErr } = await admin
    .from('corsi')
    .select('id, title, tipo, ore_totali, modalita, formatore_id, project_id')
    .in('id', corso_ids)
    .eq('project_id', progettoId)
    .not('formatore_id', 'is', null)

  if (corsiErr) return NextResponse.json({ error: corsiErr.message }, { status: 500 })

  // Mark as definitive assignments (not pre-assigned, mark as notified)
  const { error } = await admin
    .from('corsi')
    .update({ pre_assegnazione: false, notificato: true })
    .in('id', corso_ids)
    .eq('project_id', progettoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send confirmation email to each formatore
  if (corsi?.length) {
    const { data: progetto } = await admin
      .from('progetti')
      .select('school_name')
      .eq('id', progettoId)
      .single()

    if (progetto) {
      // Group by formatore
      const byFormatore = new Map<string, typeof corsi>()
      for (const c of corsi) {
        const key = c.formatore_id as string
        if (!byFormatore.has(key)) byFormatore.set(key, [])
        byFormatore.get(key)!.push(c)
      }

      for (const [formatoreId, fCorsi] of byFormatore) {
        try {
          const { data: formatore } = await admin
            .from('profiles')
            .select('nome, email')
            .eq('id', formatoreId)
            .single()

          if (!formatore?.email) continue

          const body = await generateEmailConfermaPreAssegnazione({
            formatore_nome: formatore.nome as string,
            corsi: fCorsi.map(c => ({
              title: c.title as string,
              tipo: c.tipo as string,
              ore_totali: Number(c.ore_totali),
              modalita: c.modalita as string | null,
            })),
            school_name: progetto.school_name as string,
            piattaforma_url: `${APP_URL}/formatore`,
          })

          await sendEmail({
            to: formatore.email as string,
            subject: `Progetto attivato — assegnazioni confermate — ${progetto.school_name}`,
            body,
            actions: [{ label: 'Accedi alla piattaforma', url: `${APP_URL}/formatore`, primary: true }],
          })
        } catch (err) {
          console.error('[conferma-pre-assegnazioni] Email send failed (non-fatal):', err)
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}
