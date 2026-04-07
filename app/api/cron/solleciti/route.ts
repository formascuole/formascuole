import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSollecitoEmail, generateReminderSessioneEmail, sendEmail } from '@/lib/email'

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

    // ── Reminder sessioni: find sessions from yesterday that are not confirmed ──
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: sessioniDaConfermare } = await supabase
      .from('sessioni')
      .select(`
        id,
        corso_id,
        data,
        ore,
        corso:corsi(
          id,
          title,
          formatore_id,
          project:progetti(school_name)
        )
      `)
      .eq('data', yesterdayStr)
      .eq('completata', false)
      .not('corso.formatore_id', 'is', null)

    const reminderResults: { sessione_id: string; action: string }[] = []

    for (const sessione of sessioniDaConfermare || []) {
      const corso = (sessione.corso as unknown) as {
        id: string; title: string; formatore_id: string;
        project: { school_name: string } | null
      } | null
      if (!corso || !corso.formatore_id || !corso.project) continue

      // Get formatore profile
      const { data: formatore } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('id', corso.formatore_id)
        .single()
      if (!formatore) continue

      // Check we haven't already sent a reminder for this specific session today
      const { data: existingReminder } = await supabase
        .from('solleciti_log')
        .select('id')
        .eq('corso_id', sessione.corso_id)
        .eq('tipo', 'reminder_sessione')
        .gte('sent_at', `${now.toISOString().split('T')[0]}T00:00:00Z`)
        .maybeSingle()

      if (existingReminder) {
        reminderResults.push({ sessione_id: sessione.id, action: 'already_sent_today' })
        continue
      }

      try {
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'
        const emailBody = await generateReminderSessioneEmail({
          formatore_nome: formatore.nome,
          formatore_email: formatore.email,
          corso_title: corso.title,
          school_name: corso.project.school_name,
          data_sessione: yesterdayStr,
          ore_sessione: Number(sessione.ore),
          corso_url: `${APP_URL}/progetti/${corso.id}`,
        })

        await sendEmail({
          to: formatore.email,
          subject: `Reminder: conferma sessione del ${yesterdayStr} — ${corso.title}`,
          body: emailBody,
        })

        await supabase.from('solleciti_log').insert({
          corso_id: sessione.corso_id,
          formatore_id: corso.formatore_id,
          tipo: 'reminder_sessione',
        })

        reminderResults.push({ sessione_id: sessione.id, action: 'sent_reminder' })
      } catch {
        reminderResults.push({ sessione_id: sessione.id, action: 'email_error' })
      }
    }

    return NextResponse.json({
      success: true,
      processed: corsiIncomplete.length,
      results,
      reminder_sessioni_processed: (sessioniDaConfermare || []).length,
      reminder_results: reminderResults,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Cron solleciti error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
