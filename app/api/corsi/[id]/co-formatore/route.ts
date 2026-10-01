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
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { co_formatore_id, ore_formatore, ore_co_formatore, tariffa_oraria_co_formatore } = body

  const adminClient = createAdminClient()

  // Fetch current corso
  const { data: corso, error: corsoErr } = await adminClient
    .from('corsi')
    .select('ore_totali, formatore_id, tariffa_oraria')
    .eq('id', id)
    .single()

  if (corsoErr || !corso) {
    return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  }

  if (!corso.formatore_id) {
    return NextResponse.json({ error: 'Assegna prima il formatore principale prima di aggiungere un co-formatore' }, { status: 400 })
  }

  // Build update payload
  let updateData: Record<string, unknown>

  if (!co_formatore_id) {
    // Removing co-formatore — reset all co-formatore fields and restore ore_formatore to null
    updateData = {
      co_formatore_id: null,
      ore_formatore: null,
      ore_co_formatore: null,
      tariffa_oraria_co_formatore: null,
      stato_assegnazione_co_formatore: 'non_assegnato',
    }
  } else {
    // Validate ore
    const oreFmt = ore_formatore != null ? Number(ore_formatore) : null
    const oreCoFmt = ore_co_formatore != null ? Number(ore_co_formatore) : null

    if (oreFmt == null || oreCoFmt == null) {
      return NextResponse.json({ error: 'ore_formatore e ore_co_formatore sono obbligatori' }, { status: 400 })
    }

    if (oreFmt + oreCoFmt !== corso.ore_totali) {
      return NextResponse.json({
        error: `La somma delle ore (${oreFmt} + ${oreCoFmt} = ${oreFmt + oreCoFmt}) deve essere uguale alle ore totali del corso (${corso.ore_totali})`,
      }, { status: 400 })
    }

    // Resolve co-formatore tariffa
    let tariffaCoFmt: number | null = tariffa_oraria_co_formatore != null ? Number(tariffa_oraria_co_formatore) : null

    if (!tariffaCoFmt || tariffaCoFmt <= 0) {
      // Try to get from profile
      const { data: coFmtProfile } = await adminClient
        .from('profiles')
        .select('nome, tariffa_oraria_formatore')
        .eq('id', co_formatore_id)
        .single()

      tariffaCoFmt = coFmtProfile?.tariffa_oraria_formatore != null
        ? Number(coFmtProfile.tariffa_oraria_formatore)
        : null

      if (!tariffaCoFmt || tariffaCoFmt <= 0) {
        const { data: coFmtProfile2 } = await adminClient
          .from('profiles')
          .select('nome')
          .eq('id', co_formatore_id)
          .single()
        return NextResponse.json({
          error: 'TARIFFA_MANCANTE',
          message: 'Tariffa oraria mancante per il co-formatore',
          co_formatore_id,
          co_formatore_nome: (coFmtProfile2?.nome as string | null) ?? '—',
        }, { status: 400 })
      }
    }

    updateData = {
      co_formatore_id,
      ore_formatore: oreFmt,
      ore_co_formatore: oreCoFmt,
      tariffa_oraria_co_formatore: tariffaCoFmt,
      stato_assegnazione_co_formatore: 'in_attesa',
    }
  }

  const { data, error } = await adminClient
    .from('corsi')
    .update(updateData)
    .eq('id', id)
    .select('*, formatore:profiles!formatore_id(id,nome,email), co_formatore:profiles!co_formatore_id(id,nome,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se stiamo assegnando un co-formatore (non rimuovendo), invia email di notifica
  if (co_formatore_id && data) {
    try {
      const coFormatore = (data as any).co_formatore as { id: string; nome: string; email: string } | null
      const corsoTitolo = (data as any).title as string
      const corsoTipo = (data as any).tipo as string | null
      const oreCoFmt = (data as any).ore_co_formatore as number

      const [{ data: progetto }, { data: formatoreRef }] = await Promise.all([
        adminClient.from('progetti').select('school_name, ref_name, ref_email').eq('id', (data as any).project_id).single(),
        adminClient.from('profiles').select('nome, email').eq('id', corso.formatore_id).single(),
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
      console.error('[co-formatore] Email notifica fallita (non bloccante):', emailErr)
    }
  }

  return NextResponse.json(data)
}
