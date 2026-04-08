import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UtenteStats {
  n_corsi_formatore: number
  ore_formatore: number
  n_corsi_tutor: number
  ore_tutor: number
  pct: number
  tasso_accettazione: number | null  // null = no data yet
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const [{ data: corsi, error: corsiError }, { data: sessioni, error: sessioniError }] = await Promise.all([
    admin.from('corsi').select('id, formatore_id, tutor_id, ore_totali, stato_assegnazione'),
    admin.from('sessioni').select('corso_id, ore'),
  ])

  if (corsiError) return NextResponse.json({ error: corsiError.message }, { status: 500 })
  if (sessioniError) return NextResponse.json({ error: sessioniError.message }, { status: 500 })

  // ore_pianificate per corso
  const orePianMap = new Map<string, number>()
  for (const s of sessioni || []) {
    orePianMap.set(s.corso_id, (orePianMap.get(s.corso_id) ?? 0) + Number(s.ore))
  }

  type Accum = {
    n_corsi_formatore: number; ore_formatore: number
    n_corsi_tutor: number; ore_tutor: number
    tot_ore: number; tot_pian: number
    accettati: number; rifiutati: number
  }
  const acc = new Map<string, Accum>()
  const empty = (): Accum => ({
    n_corsi_formatore: 0, ore_formatore: 0,
    n_corsi_tutor: 0, ore_tutor: 0,
    tot_ore: 0, tot_pian: 0,
    accettati: 0, rifiutati: 0,
  })

  for (const c of corsi || []) {
    const oreTot = Number(c.ore_totali)
    const orePian = orePianMap.get(c.id) ?? 0

    if (c.formatore_id) {
      const s = acc.get(c.formatore_id) ?? empty()
      s.n_corsi_formatore++
      s.ore_formatore += oreTot
      s.tot_ore += oreTot
      s.tot_pian += orePian
      if (c.stato_assegnazione === 'accettato') s.accettati++
      acc.set(c.formatore_id, s)
    }

    if (c.tutor_id) {
      const s = acc.get(c.tutor_id) ?? empty()
      s.n_corsi_tutor++
      s.ore_tutor += oreTot
      s.tot_ore += oreTot
      s.tot_pian += orePian
      acc.set(c.tutor_id, s)
    }
  }

  // Also count rifiutati (formatore_id is null after rejection — use a separate query)
  const { data: rifiutati } = await admin
    .from('corsi')
    .select('id, rifiuto_motivazione')
    .eq('stato_assegnazione', 'rifiutato')

  // For rifiutati, we can't get formatore_id (it was nulled). We'll rely on solleciti_log
  // to associate the refusal with the original formatore.
  const { data: rifiutiLog } = await admin
    .from('solleciti_log')
    .select('corso_id, formatore_id')
    .eq('tipo', 'assegnazione')
    .in('corso_id', (rifiutati || []).map(r => r.id))

  for (const log of rifiutiLog || []) {
    if (!log.formatore_id) continue
    const s = acc.get(log.formatore_id) ?? empty()
    s.rifiutati++
    acc.set(log.formatore_id, s)
  }

  const result: Record<string, UtenteStats> = {}
  for (const [uid, s] of acc) {
    const totRisposte = s.accettati + s.rifiutati
    result[uid] = {
      n_corsi_formatore: s.n_corsi_formatore,
      ore_formatore: s.ore_formatore,
      n_corsi_tutor: s.n_corsi_tutor,
      ore_tutor: s.ore_tutor,
      pct: s.tot_ore > 0 ? Math.round((s.tot_pian / s.tot_ore) * 100) : 0,
      tasso_accettazione: totRisposte > 0 ? Math.round((s.accettati / totRisposte) * 100) : null,
    }
  }

  return NextResponse.json(result)
}
