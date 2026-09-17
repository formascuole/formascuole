import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { formatore_id, tariffa_oraria: tariffaOverride } = await request.json()

  // Fetch formatore's default tariffa AND current corso's tariffa to avoid overwriting
  const adminClient = createAdminClient()
  let tariffaFormatore: number | null = null
  let tariffaCorsoGiaImpostata = false
  if (formatore_id) {
    const [{ data: fp }, { data: currentCorso }] = await Promise.all([
      adminClient.from('profiles').select('nome, tariffa_oraria_formatore').eq('id', formatore_id).single(),
      adminClient.from('corsi').select('tariffa_oraria').eq('id', id).single(),
    ])
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
    .select('*, formatore:profiles!formatore_id(id,nome,email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
