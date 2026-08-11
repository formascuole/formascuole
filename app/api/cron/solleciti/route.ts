import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'
import {
  generateSollecitoEmail,
  generateSollecitoAccettazioneEmail,
  generateRispostaFormatoreEmail,
  generateReminderSessioneEmail,
  generateReminderQuestionarioEmail,
  generateCandidaturaDisponibileEmail,
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
    // Target sessions whose date was at least 12h ago
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    const targetDateStr = twelveHoursAgo.toISOString().split('T')[0]

    const { data: sessioniDaConfermare } = await supabase
      .from('sessioni')
      .select(`
        id, corso_id, data, ore,
        corso:corsi(id, title, formatore_id, project:progetti(school_name))
      `)
      .eq('data', targetDateStr)
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
        .gte('sent_at', `${targetDateStr}T00:00:00Z`)
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
          data_sessione: targetDateStr,
          ore_sessione: Number(sessione.ore),
          corso_url: `${APP_URL}/progetti/${corso.id}`,
          piattaforma_futura_url: 'https://pnrr.istruzione.it',
        })

        await sendEmail({
          to: formatore.email,
          subject: `Promemoria — Sessione del ${targetDateStr} da confermare`,
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

    // ── FASE 5: Gestione candidature scadute ──────────────────────────────────
    const { data: corsiCandidatureAperte } = await supabase
      .from('corsi')
      .select('id, title, project_id, candidature_aperte_at')
      .eq('candidature_aperte', true)
      .not('candidature_aperte_at', 'is', null)

    const candidatureResults: { corso_id: string; action: string }[] = []

    for (const cc of corsiCandidatureAperte || []) {
      const apertaAt = new Date(cc.candidature_aperte_at as string)
      const hoursOpen = (now.getTime() - apertaAt.getTime()) / (1000 * 60 * 60)

      const { count: nCandidature } = await supabase
        .from('candidature_corsi')
        .select('*', { count: 'exact', head: true })
        .eq('corso_id', cc.id)

      // 20h reminder to formatori who haven't applied (runs once per opening)
      if (hoursOpen >= 20 && hoursOpen < 24 && (!nCandidature || nCandidature === 0)) {
        const { data: alreadyReminded } = await supabase
          .from('solleciti_log')
          .select('id')
          .eq('corso_id', cc.id)
          .eq('tipo', 'reminder_candidatura')
          .maybeSingle()

        if (!alreadyReminded) {
          const { data: formatori } = await supabase.from('profiles').select('nome, email').eq('role', 'formatore')
          const { data: progetto } = await supabase.from('progetti').select('school_name').eq('id', cc.project_id).single()
          const { data: corsoInfo } = await supabase.from('corsi').select('tipo, ore_totali').eq('id', cc.id).single()

          for (const f of formatori || []) {
            try {
              const body = await generateCandidaturaDisponibileEmail({
                formatore_nome: f.nome,
                corso_title: cc.title,
                tipo: corsoInfo?.tipo || '',
                school_name: progetto?.school_name || '',
                ore_totali: corsoInfo?.ore_totali || 0,
                corso_url: `${APP_URL}/formatore`,
              })
              sendEmail({
                to: f.email,
                subject: `Ultimo giorno per candidarti — ${cc.title}`,
                body,
                actions: [{ label: 'Candidati ora', url: `${APP_URL}/formatore`, primary: true }],
              }).catch(() => {})
            } catch { /* ignore */ }
          }

          // Log with a sentinel (use the admin ID of the first admin, or skip if none)
          const { data: firstAdmin } = await supabase
            .from('profiles').select('id').in('role', ['admin', 'super_admin']).limit(1).single()
          if (firstAdmin) {
            supabase.from('solleciti_log').insert({
              corso_id: cc.id,
              formatore_id: firstAdmin.id,
              tipo: 'reminder_candidatura',
            })
          }

          candidatureResults.push({ corso_id: cc.id, action: 'sent_20h_reminder' })
        } else {
          candidatureResults.push({ corso_id: cc.id, action: '20h_reminder_already_sent' })
        }
      }

      // 24h auto-close
      if (hoursOpen >= 24) {
        await supabase.from('corsi').update({ candidature_aperte: false }).eq('id', cc.id)

        if (!nCandidature || nCandidature === 0) {
          const { data: progetto } = await supabase.from('progetti').select('school_name').eq('id', cc.project_id).single()
          const { data: admins } = await supabase.from('profiles').select('email').in('role', ['admin', 'super_admin'])
          for (const a of admins || []) {
            sendEmail({
              to: a.email,
              subject: `Nessuna candidatura ricevuta — ${cc.title}`,
              body: `Nessun formatore si è candidato per il corso "${cc.title}" presso ${progetto?.school_name || '—'}.\n\nLe candidature sono state chiuse automaticamente dopo 24 ore.\n\nAccedi alla piattaforma per gestire il corso.\n\n${APP_URL}`,
            }).catch(() => {})
          }
          candidatureResults.push({ corso_id: cc.id, action: 'auto_closed_no_candidature' })
        } else {
          candidatureResults.push({ corso_id: cc.id, action: 'auto_closed_with_candidature' })
        }
      }
    }

    // ── FASE 6: Invio lettere incarico pending ────────────────────────────────
    const letteraResults: { corso_id: string; action: string }[] = []

    // Formatore letters
    const { data: corsiLetteraPending } = await supabase
      .from('corsi')
      .select('id, title, tipo, formatore_id, project_id')
      .eq('lettera_incarico_pending', true)
      .not('lettera_incarico_url', 'is', null)

    // Group by formatore_id + project_id
    type LetteraGroup = { formatore_id: string; project_id: string; corsi: Array<{ id: string; title: string; tipo: string }> }
    const letteraGroupMap = new Map<string, LetteraGroup>()
    for (const c of corsiLetteraPending || []) {
      const key = `${c.formatore_id}::${c.project_id}`
      if (!letteraGroupMap.has(key)) {
        letteraGroupMap.set(key, { formatore_id: c.formatore_id as string, project_id: c.project_id as string, corsi: [] })
      }
      letteraGroupMap.get(key)!.corsi.push({ id: c.id as string, title: c.title as string, tipo: c.tipo as string })
    }

    for (const group of letteraGroupMap.values()) {
      try {
        const [{ data: formatore }, { data: progetto }] = await Promise.all([
          supabase.from('profiles').select('nome, email').eq('id', group.formatore_id).single(),
          supabase.from('progetti').select('school_name, id, status').eq('id', group.project_id).single(),
        ])
        if (!formatore || !progetto) continue
        if (progetto.status !== 'active') continue

        const corsoIdsSent = group.corsi.map(c => c.id)

        const elenco = group.corsi.map(c => `  • ${c.title}`).join('\n')
        const lettereUrl = `${APP_URL}/formatore/lettere-incarico`
        const body = `Gentile ${formatore.nome},

${group.corsi.length === 1 ? 'la lettera di incarico è disponibile' : `le ${group.corsi.length} lettere di incarico sono disponibili`} per i corsi del progetto presso ${progetto.school_name}:

${elenco}

Accedi alla piattaforma per visualizzare e firmare ${group.corsi.length === 1 ? 'la lettera' : 'le lettere'} digitalmente:
${lettereUrl}

Cordiali saluti,
Il team Formascuole`

        await sendEmail({
          to: formatore.email as string,
          subject: `Lettera${group.corsi.length > 1 ? 're' : ''} di incarico — ${progetto.school_name}`,
          body,
          actions: [{ label: 'Visualizza e firma', url: lettereUrl, primary: true }],
        })

        const inviataAt = now.toISOString()
        for (const id of corsoIdsSent) {
          await supabase.from('corsi').update({
            lettera_incarico_pending: false,
            lettera_incarico_inviata_at: inviataAt,
          }).eq('id', id)
          letteraResults.push({ corso_id: id, action: 'sent_lettera_formatore' })
        }
      } catch (err) {
        console.error('[cron] Lettera formatore send failed:', err)
        for (const c of group.corsi) letteraResults.push({ corso_id: c.id, action: 'lettera_email_error' })
      }
    }

    // Tutor letters — same pattern
    const { data: corsiLetteraTutorPending } = await supabase
      .from('corsi')
      .select('id, title, tutor_id, project_id')
      .eq('lettera_tutor_pending', true)
      .not('lettera_tutor_url', 'is', null)

    type LetteraTutorGroup = { tutor_id: string; project_id: string; corsi: Array<{ id: string; title: string }> }
    const letteraTutorGroupMap = new Map<string, LetteraTutorGroup>()
    for (const c of corsiLetteraTutorPending || []) {
      const key = `${c.tutor_id}::${c.project_id}`
      if (!letteraTutorGroupMap.has(key)) {
        letteraTutorGroupMap.set(key, { tutor_id: c.tutor_id as string, project_id: c.project_id as string, corsi: [] })
      }
      letteraTutorGroupMap.get(key)!.corsi.push({ id: c.id as string, title: c.title as string })
    }

    for (const group of letteraTutorGroupMap.values()) {
      try {
        const [{ data: tutor }, { data: progetto }] = await Promise.all([
          supabase.from('profiles').select('nome, email').eq('id', group.tutor_id).single(),
          supabase.from('progetti').select('school_name, id, status').eq('id', group.project_id).single(),
        ])
        if (!tutor || !progetto) continue
        if (progetto.status !== 'active') continue

        const corsoIdsSent = group.corsi.map(c => c.id)

        const elenco = group.corsi.map(c => `  • ${c.title}`).join('\n')
        const lettereUrl = `${APP_URL}/formatore/lettere-incarico`
        const body = `Gentile ${tutor.nome},

${group.corsi.length === 1 ? 'la lettera di incarico di tutoraggio è disponibile' : `le ${group.corsi.length} lettere di incarico di tutoraggio sono disponibili`} per i corsi del progetto presso ${progetto.school_name}:

${elenco}

Accedi alla piattaforma per visualizzare e firmare ${group.corsi.length === 1 ? 'la lettera' : 'le lettere'} digitalmente:
${lettereUrl}

Cordiali saluti,
Il team Formascuole`

        await sendEmail({
          to: tutor.email as string,
          subject: `Lettera${group.corsi.length > 1 ? 're' : ''} di incarico tutoraggio — ${progetto.school_name}`,
          body,
          actions: [{ label: 'Visualizza e firma', url: lettereUrl, primary: true }],
        })

        const inviataAt = now.toISOString()
        for (const id of corsoIdsSent) {
          await supabase.from('corsi').update({
            lettera_tutor_pending: false,
            lettera_tutor_inviata_at: inviataAt,
          }).eq('id', id)
          letteraResults.push({ corso_id: id, action: 'sent_lettera_tutor' })
        }
      } catch (err) {
        console.error('[cron] Lettera tutor send failed:', err)
        for (const c of group.corsi) letteraResults.push({ corso_id: c.id, action: 'lettera_tutor_email_error' })
      }
    }

    // ── FASE 7: Solleciti firma lettere ───────────────────────────────────────
    const sollecitiFirmaResults: { corso_id: string; action: string }[] = []
    const cutoff24hLettera = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // Formatore: inviata >24h ago, not signed, (no sollecito or sollecito >24h ago)
    const { data: corsiSollecitaFormatore } = await supabase
      .from('corsi')
      .select('id, title, formatore_id, project_id, lettera_incarico_sollecito_at')
      .not('lettera_incarico_inviata_at', 'is', null)
      .eq('lettera_incarico_firmata', false)
      .lt('lettera_incarico_inviata_at', cutoff24hLettera)

    const sollecitaFormGroups = new Map<string, { formatore_id: string; project_id: string; corsi: Array<{ id: string; title: string; sollecito_at: string | null }> }>()
    for (const c of corsiSollecitaFormatore || []) {
      const sollecitoAt = c.lettera_incarico_sollecito_at as string | null
      // Skip if sollecito was sent less than 24h ago
      if (sollecitoAt && new Date(sollecitoAt) > new Date(cutoff24hLettera)) continue
      const key = `${c.formatore_id}::${c.project_id}`
      if (!sollecitaFormGroups.has(key)) {
        sollecitaFormGroups.set(key, { formatore_id: c.formatore_id as string, project_id: c.project_id as string, corsi: [] })
      }
      sollecitaFormGroups.get(key)!.corsi.push({ id: c.id as string, title: c.title as string, sollecito_at: sollecitoAt })
    }

    for (const group of sollecitaFormGroups.values()) {
      try {
        const [{ data: formatore }, { data: progetto }] = await Promise.all([
          supabase.from('profiles').select('nome, email').eq('id', group.formatore_id).single(),
          supabase.from('progetti').select('school_name, id').eq('id', group.project_id).single(),
        ])
        if (!formatore || !progetto) continue

        const elenco = group.corsi.map(c => `  • ${c.title}`).join('\n')
        const lettera_url = `${APP_URL}/formatore/lettere-incarico`
        const body = `Gentile ${formatore.nome},

le ricordiamo che ${group.corsi.length === 1 ? 'la lettera di incarico' : 'le lettere di incarico'} per i seguenti corsi presso ${progetto.school_name} ${group.corsi.length === 1 ? 'non è ancora stata firmata' : 'non sono ancora state firmate'}:

${elenco}

La preghiamo di procedere con la firma digitale accedendo alla piattaforma:
${lettera_url}

Cordiali saluti,
Il team Formascuole`

        await sendEmail({
          to: formatore.email as string,
          subject: `Sollecito firma lettera d'incarico — ${progetto.school_name}`,
          body,
          actions: [{ label: 'Firma lettera', url: lettera_url, primary: true }],
        })

        const sollecitoAt = now.toISOString()
        for (const c of group.corsi) {
          await supabase.from('corsi').update({ lettera_incarico_sollecito_at: sollecitoAt }).eq('id', c.id)
          sollecitiFirmaResults.push({ corso_id: c.id, action: 'sent_sollecito_firma_formatore' })
        }
      } catch (err) {
        console.error('[cron] Sollecito firma formatore failed:', err)
        for (const c of group.corsi) sollecitiFirmaResults.push({ corso_id: c.id, action: 'sollecito_firma_error' })
      }
    }

    // Tutor: same pattern
    const { data: corsiSollecitaTutor } = await supabase
      .from('corsi')
      .select('id, title, tutor_id, project_id, lettera_tutor_sollecito_at')
      .not('lettera_tutor_inviata_at', 'is', null)
      .eq('lettera_tutor_firmata', false)
      .lt('lettera_tutor_inviata_at', cutoff24hLettera)

    const sollecitaTutorGroups = new Map<string, { tutor_id: string; project_id: string; corsi: Array<{ id: string; title: string; sollecito_at: string | null }> }>()
    for (const c of corsiSollecitaTutor || []) {
      const sollecitoAt = c.lettera_tutor_sollecito_at as string | null
      if (sollecitoAt && new Date(sollecitoAt) > new Date(cutoff24hLettera)) continue
      const key = `${c.tutor_id}::${c.project_id}`
      if (!sollecitaTutorGroups.has(key)) {
        sollecitaTutorGroups.set(key, { tutor_id: c.tutor_id as string, project_id: c.project_id as string, corsi: [] })
      }
      sollecitaTutorGroups.get(key)!.corsi.push({ id: c.id as string, title: c.title as string, sollecito_at: sollecitoAt })
    }

    for (const group of sollecitaTutorGroups.values()) {
      try {
        const [{ data: tutor }, { data: progetto }] = await Promise.all([
          supabase.from('profiles').select('nome, email').eq('id', group.tutor_id).single(),
          supabase.from('progetti').select('school_name, id').eq('id', group.project_id).single(),
        ])
        if (!tutor || !progetto) continue

        const elenco = group.corsi.map(c => `  • ${c.title}`).join('\n')
        const lettera_url = `${APP_URL}/formatore/lettere-incarico`
        const body = `Gentile ${tutor.nome},

le ricordiamo che ${group.corsi.length === 1 ? 'la lettera di incarico di tutoraggio' : 'le lettere di incarico di tutoraggio'} per i seguenti corsi presso ${progetto.school_name} ${group.corsi.length === 1 ? 'non è ancora stata firmata' : 'non sono ancora state firmate'}:

${elenco}

La preghiamo di procedere con la firma digitale accedendo alla piattaforma:
${lettera_url}

Cordiali saluti,
Il team Formascuole`

        await sendEmail({
          to: tutor.email as string,
          subject: `Sollecito firma lettera d'incarico tutoraggio — ${progetto.school_name}`,
          body,
          actions: [{ label: 'Firma lettera', url: lettera_url, primary: true }],
        })

        const sollecitoAt = now.toISOString()
        for (const c of group.corsi) {
          await supabase.from('corsi').update({ lettera_tutor_sollecito_at: sollecitoAt }).eq('id', c.id)
          sollecitiFirmaResults.push({ corso_id: c.id, action: 'sent_sollecito_firma_tutor' })
        }
      } catch (err) {
        console.error('[cron] Sollecito firma tutor failed:', err)
        for (const c of group.corsi) sollecitiFirmaResults.push({ corso_id: c.id, action: 'sollecito_firma_tutor_error' })
      }
    }

    // ── FASE 8: Riepilogo accettazioni giornaliere (solo run serale ≥ 12 UTC) ───
    const riepilogoResults: { project_id: string; action: string }[] = []

    if (now.getUTCHours() >= 12) {
      const { data: corsiConRisposta } = await supabase
        .from('corsi')
        .select('id, title, ore_totali, formatore_id, project_id, stato_assegnazione, accettazione_risposta_at, rifiuto_motivazione')
        .in('stato_assegnazione', ['accettato', 'rifiutato'])
        .gte('accettazione_risposta_at', cutoff24h.toISOString())

      if (corsiConRisposta?.length) {
        const byProgetto = new Map<string, typeof corsiConRisposta>()
        for (const c of corsiConRisposta) {
          const key = c.project_id as string
          if (!byProgetto.has(key)) byProgetto.set(key, [])
          byProgetto.get(key)!.push(c)
        }

        const { data: admins } = await supabase
          .from('profiles')
          .select('email')
          .in('role', ['admin', 'super_admin'])
        const adminEmails = (admins || []).map(a => a.email as string).filter(Boolean)

        for (const [progettoId, corsiRisposta] of byProgetto) {
          try {
            // De-duplication: send at most one riepilogo per project per calendar day
            const { data: alreadySent } = await supabase
              .from('solleciti_log')
              .select('id')
              .eq('corso_id', progettoId)
              .eq('tipo', 'riepilogo_accettazioni')
              .gte('sent_at', `${todayStr}T00:00:00Z`)
              .maybeSingle()
            if (alreadySent) {
              riepilogoResults.push({ project_id: progettoId, action: 'already_sent_today' })
              continue
            }

            const [{ data: progetto }, { data: corsiInAttesa }] = await Promise.all([
              supabase.from('progetti').select('id, school_name').eq('id', progettoId).single(),
              supabase.from('corsi')
                .select('id, title, ore_totali, formatore_id, accettazione_richiesta_at')
                .eq('project_id', progettoId)
                .eq('stato_assegnazione', 'in_attesa')
                .not('formatore_id', 'is', null),
            ])
            if (!progetto) continue

            const allFormatoreIds = [...new Set([
              ...corsiRisposta.map(c => c.formatore_id as string),
              ...(corsiInAttesa || []).map(c => c.formatore_id as string),
            ].filter(Boolean))]
            const { data: formatori } = allFormatoreIds.length
              ? await supabase.from('profiles').select('id, nome').in('id', allFormatoreIds)
              : { data: [] }
            const nomeFmt = new Map((formatori || []).map(f => [f.id as string, f.nome as string]))

            const accettati = corsiRisposta.filter(c => c.stato_assegnazione === 'accettato')
            const rifiutati = corsiRisposta.filter(c => c.stato_assegnazione === 'rifiutato')
            const todayFmt = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

            const lines: string[] = [
              `Riepilogo delle risposte ricevute oggi per il progetto presso ${progetto.school_name}:`,
              '',
            ]

            if (accettati.length > 0) {
              lines.push('✅ ACCETTATI:')
              for (const c of accettati) {
                lines.push(`  - ${nomeFmt.get(c.formatore_id as string) ?? '—'} — ${c.title} — ${c.ore_totali}h`)
              }
              lines.push('')
            }

            if (rifiutati.length > 0) {
              lines.push('❌ RIFIUTATI:')
              for (const c of rifiutati) {
                lines.push(`  - ${nomeFmt.get(c.formatore_id as string) ?? '—'} — ${c.title} — ${c.ore_totali}h`)
                if (c.rifiuto_motivazione) lines.push(`    Motivazione: ${c.rifiuto_motivazione}`)
              }
              lines.push('')
            }

            if ((corsiInAttesa || []).length > 0) {
              lines.push('⏳ ANCORA IN ATTESA:')
              for (const c of corsiInAttesa || []) {
                const dataInvio = c.accettazione_richiesta_at
                  ? new Date(c.accettazione_richiesta_at as string).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '—'
                lines.push(`  - ${nomeFmt.get(c.formatore_id as string) ?? '—'} — ${c.title} — ${c.ore_totali}h`)
                lines.push(`    (inviato il ${dataInvio})`)
              }
              lines.push('')
            }

            const progettoUrl = `${APP_URL}/progetti/${progettoId}`
            lines.push(`Accedi alla piattaforma per gestire le assegnazioni:\n${progettoUrl}`)

            const subject = `Riepilogo accettazioni — ${progetto.school_name} — ${todayFmt}`
            const body = lines.join('\n')

            for (const email of adminEmails) {
              await sendEmail({
                to: email,
                subject,
                body,
                actions: [{ label: 'Gestisci assegnazioni', url: progettoUrl, primary: true }],
              }).catch(() => {})
            }

            // Log so subsequent cron runs skip this project today
            const { data: firstAdmin } = await supabase
              .from('profiles').select('id').in('role', ['admin', 'super_admin']).limit(1).single()
            if (firstAdmin) {
              await supabase.from('solleciti_log').insert({
                corso_id: progettoId,
                formatore_id: firstAdmin.id,
                tipo: 'riepilogo_accettazioni',
              })
            }

            riepilogoResults.push({
              project_id: progettoId,
              action: `sent (${accettati.length} acc, ${rifiutati.length} rif, ${(corsiInAttesa || []).length} att)`,
            })
          } catch (err) {
            console.error('[cron] Riepilogo failed for project', progettoId, err)
            riepilogoResults.push({ project_id: progettoId, action: 'error' })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      run_type: now.getUTCHours() >= 12 ? 'sera' : 'mattina',
      accettazione_processed: (pendingCorsi || []).length,
      accettazione_results: accettazioneResults,
      processed: (corsiIncomplete || []).length,
      results,
      reminder_sessioni_date: targetDateStr,
      reminder_sessioni_processed: (sessioniDaConfermare || []).length,
      reminder_results: reminderResults,
      questionario_processed: corsoIdsOggi.length,
      questionario_results: questionarioResults,
      candidature_processed: (corsiCandidatureAperte || []).length,
      candidature_results: candidatureResults,
      lettere_processed: letteraResults.length,
      lettere_results: letteraResults,
      solleciti_firma_processed: sollecitiFirmaResults.length,
      solleciti_firma_results: sollecitiFirmaResults,
      riepilogo_accettazioni_processed: riepilogoResults.length,
      riepilogo_accettazioni_results: riepilogoResults,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Cron solleciti error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
