import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAssegnazioneEmail, sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { formatore_id, tariffa_oraria: tariffaOverride, ore_formatore, co_formatore_id, ore_co_formatore } = await request.json()

  // Fetch formatore's default tariffa AND current corso's tariffa to avoid overwriting
  const adminClient = createAdminClient()
  let tariffaFormatore: number | null = null
  let tariffaCorsoGiaImpostata = false
  let tariffaCoFormatore: number | null = null
  if (formatore_id) {
    const queries: Promise<unknown>[] = [
      adminClient.from('profiles').select('nome, tariffa_oraria_formatore').eq('id', formatore_id).single(),
      adminClient.from('corsi').select('tariffa_oraria, ore_totali').eq('id', id).single(),
    ]
    if (co_formatore_id) {
      queries.push(adminClient.from('profiles').select('nome, tariffa_oraria_formatore, email').eq('id', co_formatore_id).single())
    }
    const results = await Promise.all(queries)
    const { data: fp } = results[0] as { data: { nome: string; tariffa_oraria_formatore: number | null } | null }
    const { data: currentCorso } = results[1] as { data: { tariffa_oraria: number | null; ore_totali: number } | null }
    const profileTariffa = fp?.tariffa_oraria_formatore != null ? Number(fp.tariffa_oraria_formatore) : null
    tariffaCorsoGiaImpostata = currentCorso?.tariffa_oraria != null
    // Prefer explicit override (bulk assignment), fall back to profile tariffa
    const overrideValue = tariffaOverride != null && Number(tariffaOverride) > 0 ? Number(tariffaOverride) : null
    tariffaFormatore = overrideValue ?? profileTariffa
    // Block assignment if no tariffa available from any source
    if (!tariffaFormatore || tariffaFormatore <= 0) {
      return NextResponse.json({
        error: 'TARIFFA_MANCANTE',
        message: 'Tariffa oraria mancante',
        formatore_id: formatore_id,
        formatore_nome: (fp?.nome as string | null) ?? '—',
      }, { status: 400 })
    }

    // Validate and resolve co-formatore when provided
    if (co_formatore_id) {
      const { data: coFp } = results[2] as { data: { nome: string; tariffa_oraria_formatore: number | null; email: string } | null }
      tariffaCoFormatore = coFp?.tariffa_oraria_formatore != null ? Number(coFp.tariffa_oraria_formatore) : null
      if (!tariffaCoFormatore || tariffaCoFormatore <= 0) {
        return NextResponse.json({
          error: 'TARIFFA_MANCANTE',
          message: 'Tariffa oraria mancante per il co-formatore',
          formatore_id: co_formatore_id,
          formatore_nome: (coFp?.nome as string | null) ?? '—',
        }, { status: 400 })
      }
      // Validate ore sum
      const oreF = ore_formatore != null ? Number(ore_formatore) : null
      const oreCo = ore_co_formatore != null ? Number(ore_co_formatore) : null
      if (oreF == null || oreCo == null) {
        return NextResponse.json({ error: 'ore_formatore e ore_co_formatore sono obbligatori con co_formatore_id' }, { status: 400 })
      }
      if (currentCorso?.ore_totali != null && Math.abs(oreF + oreCo - currentCorso.ore_totali) > 0.01) {
        return NextResponse.json({
          error: `La somma delle ore (${oreF} + ${oreCo} = ${oreF + oreCo}) deve essere uguale alle ore totali del corso (${currentCorso.ore_totali})`,
        }, { status: 400 })
      }
    }
  }

  // When removing the formatore, check for lettera d'incarico
  if (!formatore_id) {
    const { data: corsoCheck } = await adminClient
      .from('corsi')
      .select('lettera_incarico_firmata, lettera_incarico_url')
      .eq('id', id)
      .single()

    if (corsoCheck?.lettera_incarico_firmata) {
      return NextResponse.json({
        error: 'LETTERA_FIRMATA',
        message: 'Impossibile rimuovere il formatore — la lettera d\'incarico è già stata firmata digitalmente. Per gestire questa situazione vai alla scheda corso e usa il bottone \'Registra rinuncia\' nella sezione del formatore.',
      }, { status: 422 })
    }

    if (corsoCheck?.lettera_incarico_url) {
      return NextResponse.json({
        error: 'LETTERA_GENERATA',
        message: 'Il formatore ha una lettera d\'incarico già generata (non ancora firmata). Rimuovendo il formatore la lettera verrà annullata automaticamente. Per procedere usa il bottone \'Registra rinuncia\' nella scheda corso oppure annulla prima la lettera dalla sezione \'Lettera d\'incarico\'.',
      }, { status: 422 })
    }
  }

  const updateData = formatore_id
    ? {
        formatore_id,
        stato_assegnazione: 'in_attesa',
        // accettazione_richiesta_at is set when the notification email is actually sent
        accettazione_richiesta_at: null,
        accettazione_risposta_at: null,
        rifiuto_motivazione: null,
        notificato: false,
        // If explicit override provided: always set; otherwise only pre-fill from profile if not already set
        ...(tariffaOverride != null
          ? { tariffa_oraria: tariffaFormatore }
          : (!tariffaCorsoGiaImpostata && tariffaFormatore != null ? { tariffa_oraria: tariffaFormatore } : {})),
        // ore_formatore: only set if provided (used when corso has co-formatore)
        ...(ore_formatore != null ? { ore_formatore: Number(ore_formatore) } : {}),
        // co-formatore fields when assigning both simultaneously
        ...(co_formatore_id
          ? {
              co_formatore_id,
              ore_co_formatore: Number(ore_co_formatore),
              tariffa_oraria_co_formatore: tariffaCoFormatore,
              stato_assegnazione_co_formatore: 'in_attesa',
            }
          : {}),
      }
    : {
        formatore_id: null,
        stato_assegnazione: 'non_assegnato',
        accettazione_richiesta_at: null,
        accettazione_risposta_at: null,
        rifiuto_motivazione: null,
        notificato: false,
        token_assegnazione: null,
      }
  const { data, error } = await adminClient
    .from('corsi')
    .update(updateData)
    .eq('id', id)
    .select('*, formatore:profiles!formatore_id(id,nome,email), co_formatore:profiles!co_formatore_id(id,nome,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send co-formatore notification email when assigning both simultaneously (non-blocking)
  if (co_formatore_id && data) {
    try {
      const coFormatore = (data as Record<string, unknown>).co_formatore as { id: string; nome: string; email: string } | null
      const corsoTitolo = (data as Record<string, unknown>).title as string
      const corsoTipo = (data as Record<string, unknown>).tipo as string | null
      const oreCoFmt = Number(ore_co_formatore)

      const [{ data: progetto }] = await Promise.all([
        adminClient.from('progetti').select('school_name, ref_name, ref_email').eq('id', (data as Record<string, unknown>).project_id as string).single(),
      ])

      if (coFormatore?.email && progetto) {
        const accetta_url = `${APP_URL}/formatore/corsi/${id}/accetta`
        const rifiuta_url = `${APP_URL}/formatore/corsi/${id}/rifiuta`

        const emailBody = await generateAssegnazioneEmail({
          formatore_nome: coFormatore.nome,
          formatore_email: coFormatore.email,
          corso_title: corsoTitolo,
          school_name: progetto.school_name,
          ref_name: progetto.ref_name,
          ref_email: progetto.ref_email,
          ore_totali: oreCoFmt,
          tipo: corsoTipo ?? undefined,
          accetta_url,
          rifiuta_url,
        })

        await sendEmail({
          to: coFormatore.email,
          subject: `Formascuole — Sei stato assegnato come co-formatore: ${corsoTitolo} — ${progetto.school_name}`,
          body: emailBody,
          actions: [
            { label: '✓ Accetta incarico', url: accetta_url, primary: true },
            { label: '✗ Rifiuta incarico', url: rifiuta_url },
          ],
        })

        await adminClient.from('solleciti_log').insert({
          corso_id: id,
          formatore_id: co_formatore_id,
          tipo: 'assegnazione_co_formatore',
        })
      }
    } catch (emailErr) {
      console.error('[formatore/route] co-formatore email failed (non-blocking):', emailErr)
    }
  }

  return NextResponse.json(data)
}
