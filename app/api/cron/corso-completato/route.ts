import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const results: { corso_id: string; action: string }[] = []

  try {
    // ── Trova corsi con ultima sessione pianificata = oggi ─────────────────────
    // Step 1: sessioni con data = oggi
    const { data: sessioniOggi } = await supabase
      .from('sessioni')
      .select('corso_id')
      .eq('data', todayStr)

    const corsoIdsOggi = [...new Set((sessioniOggi || []).map(s => s.corso_id as string))]

    if (corsoIdsOggi.length === 0) {
      return NextResponse.json({ success: true, corsi_trovati: 0, results, timestamp: now.toISOString() })
    }

    // Step 2: filtra solo quelli dove oggi è l'ULTIMA sessione pianificata
    const eligibleCorsoIds: string[] = []
    for (const corsoId of corsoIdsOggi) {
      const { count: afterCount } = await supabase
        .from('sessioni')
        .select('*', { count: 'exact', head: true })
        .eq('corso_id', corsoId)
        .gt('data', todayStr)
      if (!afterCount || afterCount === 0) {
        eligibleCorsoIds.push(corsoId)
      }
    }

    if (eligibleCorsoIds.length === 0) {
      return NextResponse.json({ success: true, corsi_trovati: 0, results, timestamp: now.toISOString() })
    }

    // Step 3: carica i corsi eleggibili che soddisfano i criteri
    const { data: corsiRaw } = await supabase
      .from('corsi')
      .select('id, title, ore_totali, formatore_id, project_id, stato_assegnazione, corso_completato')
      .in('id', eligibleCorsoIds)
      .eq('corso_completato', false)
      .not('formatore_id', 'is', null)
      .eq('stato_assegnazione', 'accettato')

    if (!corsiRaw || corsiRaw.length === 0) {
      return NextResponse.json({ success: true, corsi_trovati: 0, results, timestamp: now.toISOString() })
    }

    // Step 4: filtra per progetti active
    const projectIds = [...new Set(corsiRaw.map(c => c.project_id as string))]
    const { data: progettiRaw } = await supabase
      .from('progetti')
      .select('id, school_name, status')
      .in('id', projectIds)
      .eq('status', 'active')

    const progettiAttivi = new Map((progettiRaw || []).map(p => [p.id as string, p.school_name as string]))

    const corsiEleggibili = corsiRaw.filter(c => progettiAttivi.has(c.project_id as string))

    if (corsiEleggibili.length === 0) {
      return NextResponse.json({ success: true, corsi_trovati: 0, results, timestamp: now.toISOString() })
    }

    // Step 5: carica formatori
    const formatoreIds = [...new Set(corsiEleggibili.map(c => c.formatore_id as string))]
    const { data: formatoriRaw } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .in('id', formatoreIds)
    const formatoriMap = new Map((formatoriRaw || []).map(f => [f.id as string, f]))

    // Step 6: calcola ore erogate per ogni corso
    const { data: sessioniCompletate } = await supabase
      .from('sessioni')
      .select('corso_id, ore')
      .in('corso_id', corsiEleggibili.map(c => c.id as string))
      .eq('completata', true)

    const oreErogateMap = new Map<string, number>()
    for (const s of sessioniCompletate || []) {
      const prev = oreErogateMap.get(s.corso_id as string) ?? 0
      oreErogateMap.set(s.corso_id as string, prev + Number(s.ore))
    }

    // ── EMAIL FORMATORI (una per corso, con deduplicazione) ────────────────────
    const corsiDaEmailAdmin: Array<{
      title: string
      school_name: string
      formatore_nome: string
      ore_erogate: number
      ore_totali: number
      corso_id: string
      project_id: string
    }> = []

    for (const corso of corsiEleggibili) {
      const corsoId = corso.id as string
      const formatore = formatoriMap.get(corso.formatore_id as string)
      const school_name = progettiAttivi.get(corso.project_id as string) ?? ''
      const ore_erogate = oreErogateMap.get(corsoId) ?? 0
      const ore_totali = Number(corso.ore_totali)

      // Deduplica: non inviare più di una volta al giorno per questo corso
      const { data: existing } = await supabase
        .from('solleciti_log')
        .select('id')
        .eq('corso_id', corsoId)
        .eq('tipo', 'reminder_completamento')
        .gte('sent_at', `${todayStr}T00:00:00Z`)
        .maybeSingle()

      if (existing) {
        results.push({ corso_id: corsoId, action: 'already_sent_today' })
        continue
      }

      if (!formatore) {
        results.push({ corso_id: corsoId, action: 'no_formatore' })
        continue
      }

      // Email al formatore
      const corsoUrl = `${APP_URL}/formatore`
      const emailBody = `Gentile ${formatore.nome},

oggi si è svolta l'ultima sessione pianificata del corso:

📚 ${corso.title}
🏫 ${school_name}

Per completare il processo ti chiediamo di:

1. Confermare tutte le sessioni come erogate (se non ancora fatto)
2. Cliccare il bottone "Corso completato" nella scheda del corso

Ore erogate: ${ore_erogate}h su ${ore_totali}h totali

Se hai già completato queste operazioni puoi ignorare questa email.

Cordiali saluti,
Il team Formascuole`

      try {
        await sendEmail({
          to: formatore.email,
          subject: `Promemoria: corso da concludere — ${corso.title}`,
          body: emailBody,
          actions: [{ label: 'Vai al corso →', url: corsoUrl, primary: true }],
        })

        await supabase.from('solleciti_log').insert({
          corso_id: corsoId,
          formatore_id: corso.formatore_id,
          tipo: 'reminder_completamento',
        })

        results.push({ corso_id: corsoId, action: 'sent_formatore_reminder' })

        corsiDaEmailAdmin.push({
          title: corso.title as string,
          school_name,
          formatore_nome: formatore.nome,
          ore_erogate,
          ore_totali,
          corso_id: corsoId,
          project_id: corso.project_id as string,
        })
      } catch {
        results.push({ corso_id: corsoId, action: 'email_error' })
      }
    }

    // ── DIGEST LOG ADMIN (corsi inclusi nel riepilogo delle 21:00) ────────────
    if (corsiDaEmailAdmin.length > 0) {
      const digestRows = corsiDaEmailAdmin.map(c => ({
        tipo: 'corso_da_concludere',
        payload: {
          corso_id: c.corso_id,
          titolo_corso: c.title,
          scuola: c.school_name,
          formatore: c.formatore_nome,
          ore_erogate: c.ore_erogate,
          ore_totali: c.ore_totali,
        },
      }))
      await supabase.from('admin_digest_log').insert(digestRows)
    }

    return NextResponse.json({
      success: true,
      corsi_trovati: corsiEleggibili.length,
      digest_log_added: corsiDaEmailAdmin.length,
      results,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('[cron/corso-completato] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
