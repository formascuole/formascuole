import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'
import {
  generateSollecitoEmail,
  generateSollecitoAccettazioneEmail,
  generateRispostaFormatoreEmail,
  generateReminderSessioneEmail,
  generateReminderQuestionarioEmail,
  sendEmail,
  sendQuestionarioReminderEmail,
} from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

function buildQuestionarioUrlServer(params: {
  scuola: string
  titoloCorso: string
  formatore: string
  tipoCorso: string
  lineaFinanziamento?: string
  dataSomministrazione: string
}): string {
  const base = new URL('https://www.formascuole.it/')
  base.searchParams.set('ff_landing', '13')
  base.searchParams.set('scuola', params.scuola)
  base.searchParams.set('titolo_corso', params.titoloCorso)
  base.searchParams.set('formatore', params.formatore)
  base.searchParams.set('tipo_corso', params.tipoCorso)
  base.searchParams.set('regione', '')
  base.searchParams.set('provincia', '')
  base.searchParams.set('linea_finanziamento', params.lineaFinanziamento || '')
  base.searchParams.set('data_somministrazione', params.dataSomministrazione)
  return base.toString()
}

const SOLLECITO_DELAYS = {
  first: 3,
  between: 3,
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  const accettazioneResults: { corso_id: string; action: string }[] = []

  try {
    // ── FASE 1: Gestione accettazioni pendenti ─────────────────────────────────
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { data: pendingCorsi } = await supabase
      .from('corsi')
      .select('id, title, formatore_id, project_id, accettazione_richiesta_at')
      .eq('stato_assegnazione', 'in_attesa')
      .not('accettazione_richiesta_at', 'is', null)

    for (const corso of pendingCorsi || []) {
      const richiestaAt = new Date(corso.accettazione_richiesta_at)

      if (richiestaAt < cutoff48h) {
        // ── Auto-reset: oltre 48h senza risposta ────────────────────────────
        const { data: formatore } = await supabase
          .from('profiles')
          .select('nome, email')
          .eq('id', corso.formatore_id)
          .single()

        const { data: progetto } = await supabase
          .from('progetti')
          .select('school_name')
          .eq('id', corso.project_id)
          .single()

        await supabase
          .from('corsi')
          .update({
            stato_assegnazione: 'non_assegnato',
            formatore_id: null,
            accettazione_risposta_at: now.toISOString(),
          })
          .eq('id', corso.id)

        // Notify all admins
        if (formatore && progetto) {
          const { data: admins } = await supabase
            .from('profiles')
            .select('email')
            .in('role', ['admin', 'super_admin'])

          try {
            const emailBody = await generateRispostaFormatoreEmail({
              formatore_nome: formatore.nome,
              corso_title: corso.title,
              school_name: progetto.school_name,
              risposta: 'rifiutato',
              motivazione: `Nessuna risposta entro 48 ore — corso rimesso disponibile automaticamente`,
              corso_admin_url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corso.id}`,
            })

            for (const a of admins || []) {
              sendEmail({
                to: a.email,
                subject: `Formascuole — Nessuna risposta da ${formatore.nome}: ${corso.title} rimesso disponibile`,
                body: emailBody,
                actions: [{ label: 'Riassegna il corso', url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corso.id}`, primary: true }],
              }).catch(() => {})
            }
          } catch { /* ignore email errors */ }
        }

        accettazioneResults.push({ corso_id: corso.id, action: 'auto_reset_48h' })

      } else if (richiestaAt < cutoff24h) {
        // ── Sollecito 24h: ancora in tempo ma urgente ────────────────────────
        // Check we haven't already sent the 24h reminder for this corso
        const { data: existing } = await supabase
          .from('solleciti_log')
          .select('id')
          .eq('corso_id', corso.id)
          .eq('tipo', 'reminder_accettazione')
          .maybeSingle()

        if (existing) {
          accettazioneResults.push({ corso_id: corso.id, action: 'accettazione_reminder_already_sent' })
          continue
        }

        const { data: formatore } = await supabase
          .from('profiles')
          .select('nome, email')
          .eq('id', corso.formatore_id)
          .single()

        const { data: progetto } = await supabase
          .from('progetti')
          .select('school_name')
          .eq('id', corso.project_id)
          .single()

        if (formatore && progetto) {
          const oreRimanenti = Math.max(
            Math.round((cutoff48h.getTime() - richiestaAt.getTime()) / (1000 * 60 * 60) + 24),
            1
          )

          try {
            const emailBody = await generateSollecitoAccettazioneEmail({
              formatore_nome: formatore.nome,
              corso_title: corso.title,
              school_name: progetto.school_name,
              ore_rimanenti: oreRimanenti,
              accetta_url: `${APP_URL}/formatore/corsi/${corso.id}/accetta`,
              rifiuta_url: `${APP_URL}/formatore/corsi/${corso.id}/rifiuta`,
            })

            await sendEmail({
              to: formatore.email,
              subject: `URGENTE — Rispondi entro ${oreRimanenti}h: ${corso.title} — ${progetto.school_name}`,
              body: emailBody,
              actions: [
                { label: '✓ Accetta incarico', url: `${APP_URL}/formatore/corsi/${corso.id}/accetta`, primary: true },
                { label: '✗ Rifiuta incarico', url: `${APP_URL}/formatore/corsi/${corso.id}/rifiuta` },
              ],
            })

            await supabase.from('solleciti_log').insert({
              corso_id: corso.id,
              formatore_id: corso.formatore_id,
              tipo: 'reminder_accettazione',
            })

            accettazioneResults.push({ corso_id: corso.id, action: 'sent_accettazione_reminder' })
          } catch {
            accettazioneResults.push({ corso_id: corso.id, action: 'email_error' })
          }
        }
      } else {
        accettazioneResults.push({ corso_id: corso.id, action: 'within_24h_no_action' })
      }
    }

    // ── FASE 2: Solleciti calendario (logica esistente) ────────────────────────
    const { data: corsiIncomplete } = await supabase
      .from('corsi_con_ore')
      .select(`
        id, title, formatore_id, ore_totali, ore_pianificate, calendario_completo,
        project:progetti(school_name, ref_name, ref_email),
        formatore:profiles!formatore_id(nome, email)
      `)
      .not('formatore_id', 'is', null)
      .eq('calendario_completo', false)
      .eq('stato_assegnazione', 'accettato')

    const results: { corso_id: string; action: string }[] = []

    for (const corso of corsiIncomplete || []) {
      const formatore = (corso.formatore as unknown) as { nome: string; email: string } | null
      const project = (corso.project as unknown) as { school_name: string; ref_name: string; ref_email: string } | null

      if (!formatore || !project) continue

      const { data: solleciti } = await supabase
        .from('solleciti_log')
        .select('tipo, sent_at')
        .eq('corso_id', corso.id)
        .order('sent_at', { ascending: false })

      const solleciti_tipi = (solleciti || []).map(s => s.tipo)

      if (solleciti_tipi.includes('sollecito_3')) {
        results.push({ corso_id: corso.id, action: 'skip_max_reached' })
        continue
      }

      const assegnazioneLog = (solleciti || []).find(s => s.tipo === 'assegnazione')
      const referenceDate = assegnazioneLog ? new Date(assegnazioneLog.sent_at) : now
      const daysSinceAssignment = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))

      let nextSollecito: 'sollecito_1' | 'sollecito_2' | 'sollecito_3' | null = null
      let numeroSollecito: 1 | 2 | 3 | null = null

      if (!solleciti_tipi.includes('sollecito_1')) {
        if (daysSinceAssignment >= SOLLECITO_DELAYS.first) { nextSollecito = 'sollecito_1'; numeroSollecito = 1 }
      } else if (!solleciti_tipi.includes('sollecito_2')) {
        const s1 = (solleciti || []).find(s => s.tipo === 'sollecito_1')
        if (s1) {
          const d = Math.floor((now.getTime() - new Date(s1.sent_at).getTime()) / (1000 * 60 * 60 * 24))
          if (d >= SOLLECITO_DELAYS.between) { nextSollecito = 'sollecito_2'; numeroSollecito = 2 }
        }
      } else if (!solleciti_tipi.includes('sollecito_3')) {
        const s2 = (solleciti || []).find(s => s.tipo === 'sollecito_2')
        if (s2) {
          const d = Math.floor((now.getTime() - new Date(s2.sent_at).getTime()) / (1000 * 60 * 60 * 24))
          if (d >= SOLLECITO_DELAYS.between) { nextSollecito = 'sollecito_3'; numeroSollecito = 3 }
        }
      }

      if (!nextSollecito || !numeroSollecito) {
        results.push({ corso_id: corso.id, action: 'not_yet' })
        continue
      }

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

    // ── FASE 3: Reminder sessioni ──────────────────────────────────────────────
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: sessioniDaConfermare } = await supabase
      .from('sessioni')
      .select(`
        id, corso_id, data, ore,
        corso:corsi(id, title, formatore_id, project:progetti(school_name))
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

      const { data: formatore } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('id', corso.formatore_id)
        .single()
      if (!formatore) continue

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

    // ── FASE 4: Reminder questionario — ultima sessione oggi ──────────────────
    const todayStr = now.toISOString().split('T')[0]

    const { data: sessioniOggi } = await supabase
      .from('sessioni')
      .select('corso_id')
      .eq('data', todayStr)

    const corsoIdsOggi = [...new Set((sessioniOggi || []).map(s => s.corso_id as string))]

    const questionarioResults: { corso_id: string; action: string }[] = []

    for (const corsoId of corsoIdsOggi) {
      // Only proceed if today is the last planned session for this corso
      const { count: afterCount } = await supabase
        .from('sessioni')
        .select('*', { count: 'exact', head: true })
        .eq('corso_id', corsoId)
        .gt('data', todayStr)

      if (afterCount && afterCount > 0) {
        questionarioResults.push({ corso_id: corsoId, action: 'not_last_session' })
        continue
      }

      const { data: corso } = await supabase
        .from('corsi')
        .select('id, title, tipo, formatore_id, project_id, stato_assegnazione')
        .eq('id', corsoId)
        .single()

      if (!corso || !corso.formatore_id || corso.stato_assegnazione !== 'accettato') {
        questionarioResults.push({ corso_id: corsoId, action: 'skip_not_eligible' })
        continue
      }

      // Deduplica: non inviare più di una volta al giorno per questo corso
      const { data: existingReminder } = await supabase
        .from('solleciti_log')
        .select('id')
        .eq('corso_id', corsoId)
        .eq('tipo', 'reminder_questionario')
        .gte('sent_at', `${todayStr}T00:00:00Z`)
        .maybeSingle()

      if (existingReminder) {
        questionarioResults.push({ corso_id: corsoId, action: 'already_sent_today' })
        continue
      }

      const [{ data: formatore }, { data: progetto }] = await Promise.all([
        supabase.from('profiles').select('nome, email').eq('id', corso.formatore_id).single(),
        supabase.from('progetti').select('school_name, finanziamento_id').eq('id', corso.project_id).single(),
      ])

      if (!formatore?.email) {
        questionarioResults.push({ corso_id: corsoId, action: 'no_formatore_email' })
        continue
      }

      const { data: finanziamento } = progetto?.finanziamento_id
        ? await supabase.from('finanziamenti').select('nome').eq('id', progetto.finanziamento_id).single()
        : { data: null }

      const questionarioUrl = buildQuestionarioUrlServer({
        scuola: progetto?.school_name || '',
        titoloCorso: corso.title,
        formatore: formatore.nome,
        tipoCorso: corso.tipo || '',
        lineaFinanziamento: finanziamento?.nome || '',
        dataSomministrazione: todayStr,
      })

      let qrDataUrl: string | undefined
      try {
        qrDataUrl = await QRCode.toDataURL(questionarioUrl, { margin: 2, width: 180 })
      } catch { /* continue without QR */ }

      try {
        const emailBody = await generateReminderQuestionarioEmail({
          formatore_nome: formatore.nome,
          corso_title: corso.title,
          school_name: progetto?.school_name || '',
          questionario_url: questionarioUrl,
        })

        await sendQuestionarioReminderEmail({
          to: formatore.email,
          subject: `Oggi ultima sessione — ricorda il questionario di valutazione!`,
          body: emailBody,
          questionario_url: questionarioUrl,
          qrDataUrl,
        })

        await supabase.from('solleciti_log').insert({
          corso_id: corsoId,
          formatore_id: corso.formatore_id,
          tipo: 'reminder_questionario',
        })

        questionarioResults.push({ corso_id: corsoId, action: 'sent_reminder' })
      } catch {
        questionarioResults.push({ corso_id: corsoId, action: 'email_error' })
      }
    }

    return NextResponse.json({
      success: true,
      accettazione_processed: (pendingCorsi || []).length,
      accettazione_results: accettazioneResults,
      processed: (corsiIncomplete || []).length,
      results,
      reminder_sessioni_processed: (sessioniDaConfermare || []).length,
      reminder_results: reminderResults,
      questionario_processed: corsoIdsOggi.length,
      questionario_results: questionarioResults,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Cron solleciti error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
