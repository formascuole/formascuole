import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSollecitoEmail, sendEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET

// Days delay between reminders
const SOLLECITO_DELAYS = {
  first: 3,  // days after assignment before first reminder
  between: 3, // days between reminders
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  try {
    // Find all corsi with formatore assigned but calendar incomplete
    const { data: corsiIncomplete } = await supabase
      .from('corsi_con_ore')
      .select(`
        id,
        title,
        formatore_id,
        ore_totali,
        ore_pianificate,
        calendario_completo,
        project:progetti(school_name, ref_name, ref_email),
        formatore:profiles!formatore_id(nome, email)
      `)
      .not('formatore_id', 'is', null)
      .eq('calendario_completo', false)

    if (!corsiIncomplete?.length) {
      return NextResponse.json({ message: 'No incomplete courses found', processed: 0 })
    }

    const results: { corso_id: string; action: string }[] = []

    for (const corso of corsiIncomplete) {
      const formatore = (corso.formatore as unknown) as { nome: string; email: string } | null
      const project = (corso.project as unknown) as { school_name: string; ref_name: string; ref_email: string } | null

      if (!formatore || !project) continue

      // Get all solleciti for this corso
      const { data: solleciti } = await supabase
        .from('solleciti_log')
        .select('tipo, sent_at')
        .eq('corso_id', corso.id)
        .order('sent_at', { ascending: false })

      const solleciti_tipi = (solleciti || []).map(s => s.tipo)

      // Already sent sollecito_3 — stop
      if (solleciti_tipi.includes('sollecito_3')) {
        results.push({ corso_id: corso.id, action: 'skip_max_reached' })
        continue
      }

      // Find assignment date
      const assegnazioneLog = (solleciti || []).find(s => s.tipo === 'assegnazione')
      const referenceDate = assegnazioneLog
        ? new Date(assegnazioneLog.sent_at)
        : now

      const daysSinceAssignment = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))

      let nextSollecito: 'sollecito_1' | 'sollecito_2' | 'sollecito_3' | null = null
      let numeroSollecito: 1 | 2 | 3 | null = null

      if (!solleciti_tipi.includes('sollecito_1')) {
        // No reminder yet — check if 3 days since assignment
        if (daysSinceAssignment >= SOLLECITO_DELAYS.first) {
          nextSollecito = 'sollecito_1'
          numeroSollecito = 1
        }
      } else if (!solleciti_tipi.includes('sollecito_2')) {
        // Check days since sollecito_1
        const s1 = (solleciti || []).find(s => s.tipo === 'sollecito_1')
        if (s1) {
          const daysSinceS1 = Math.floor((now.getTime() - new Date(s1.sent_at).getTime()) / (1000 * 60 * 60 * 24))
          if (daysSinceS1 >= SOLLECITO_DELAYS.between) {
            nextSollecito = 'sollecito_2'
            numeroSollecito = 2
          }
        }
      } else if (!solleciti_tipi.includes('sollecito_3')) {
        // Check days since sollecito_2
        const s2 = (solleciti || []).find(s => s.tipo === 'sollecito_2')
        if (s2) {
          const daysSinceS2 = Math.floor((now.getTime() - new Date(s2.sent_at).getTime()) / (1000 * 60 * 60 * 24))
          if (daysSinceS2 >= SOLLECITO_DELAYS.between) {
            nextSollecito = 'sollecito_3'
            numeroSollecito = 3
          }
        }
      }

      if (!nextSollecito || !numeroSollecito) {
        results.push({ corso_id: corso.id, action: 'not_yet' })
        continue
      }

      // Generate and send email
      try {
        const emailBody = await generateSollecitoEmail({
          formatore_nome: formatore.nome,
          formatore_email: formatore.email,
          corso_title: corso.title,
          school_name: project.school_name,
          ref_name: project.ref_name,
          ref_email: project.ref_email,
          numero_sollecito: numeroSollecito,
          giorni_passati: daysSinceAssignment,
        })

        await sendEmail({
          to: formatore.email,
          subject: `Formascuole — ${numeroSollecito === 1 ? 'Promemoria' : `Sollecito ${numeroSollecito}`}: ${corso.title}`,
          body: emailBody,
        })

        await supabase.from('solleciti_log').insert({
          corso_id: corso.id,
          formatore_id: corso.formatore_id,
          tipo: nextSollecito,
        })

        results.push({ corso_id: corso.id, action: `sent_${nextSollecito}` })
      } catch (emailError) {
        console.error(`Failed to send sollecito for corso ${corso.id}:`, emailError)
        results.push({ corso_id: corso.id, action: 'email_error' })
      }
    }

    return NextResponse.json({
      success: true,
      processed: corsiIncomplete.length,
      results,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Cron solleciti error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
