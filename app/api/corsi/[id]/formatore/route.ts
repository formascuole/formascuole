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

  const { formatore_id } = await request.json()

  // Fetch formatore's default tariffa AND current corso's tariffa to avoid overwriting
  const adminClient = createAdminClient()
  let tariffaFormatore: number | null = null
  let tariffaCorsoGiaImpostata = false
  if (formatore_id) {
    const [{ data: fp }, { data: currentCorso }] = await Promise.all([
      adminClient.from('profiles').select('tariffa_oraria_formatore').eq('id', formatore_id).single(),
      adminClient.from('corsi').select('tariffa_oraria').eq('id', id).single(),
    ])
    tariffaFormatore = fp?.tariffa_oraria_formatore != null ? Number(fp.tariffa_oraria_formatore) : null
    tariffaCorsoGiaImpostata = currentCorso?.tariffa_oraria != null
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
        // Only pre-fill from profile if corso doesn't already have a custom rate
        ...(!tariffaCorsoGiaImpostata && tariffaFormatore != null ? { tariffa_oraria: tariffaFormatore } : {}),
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
