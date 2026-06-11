import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    luogo_nascita, data_nascita, codice_fiscale,
    indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia,
    iban, banca, intestatario_conto,
    ha_partita_iva, regime_fiscale, rivalsa_iva, partita_iva,
  } = body

  const VALID_REGIMI = ['forfettario', 'ordinario', 'notula']

  const updates: Record<string, unknown> = {
    luogo_nascita: luogo_nascita?.trim() || null,
    data_nascita: data_nascita || null,
    codice_fiscale: codice_fiscale?.trim().toUpperCase() || null,
    indirizzo_via: indirizzo_via?.trim() || null,
    indirizzo_cap: indirizzo_cap?.trim() || null,
    indirizzo_citta: indirizzo_citta?.trim() || null,
    indirizzo_provincia: indirizzo_provincia?.trim().toUpperCase() || null,
    iban: iban?.trim().toUpperCase().replace(/\s+/g, '') || null,
    banca: banca?.trim() || null,
    intestatario_conto: intestatario_conto?.trim() || null,
    profilo_completo: true,
    partita_iva: partita_iva?.trim() || null,
  }

  if (ha_partita_iva !== undefined) {
    updates.ha_partita_iva = !!ha_partita_iva
  }
  if (regime_fiscale !== undefined && VALID_REGIMI.includes(regime_fiscale)) {
    updates.regime_fiscale = regime_fiscale
  }
  if (rivalsa_iva !== undefined) {
    updates.rivalsa_iva = !!rivalsa_iva
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
