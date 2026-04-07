import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UtenteStats {
  n_corsi_formatore: number
  ore_formatore: number
  n_corsi_tutor: number
  ore_tutor: number
  pct: number
}

export async function GET() {
  // Auth: only admins can call this
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

  // Use service role to bypass RLS completely
  const admin = createAdminClient()

  // Fetch corsi directly from base table (not the view) — avoids any view-level RLS
  const { data: corsi, error: corsiError } = await admin
    .from('corsi')
    .select('id, formatore_id, tutor_id, ore_totali')

  if (corsiError) {
    return NextResponse.json({ error: corsiError.message }, { status: 500 })
  }

  // Fetch all sessioni to compute ore_pianificate per corso
  const { data: sessioni, error: sessioniError } = await admin
    .from('sessioni')
    .select('corso_id, ore')

  if (sessioniError) {
    return NextResponse.json({ error: sessioniError.message }, { status: 500 })
  }

  // Build ore_pianificate map: corso_id → total planned hours
  const orePianMap = new Map<string, number>()
  for (const s of sessioni || []) {
    orePianMap.set(s.corso_id, (orePianMap.get(s.corso_id) ?? 0) + Number(s.ore))
  }

  // Accumulate stats per user ID
  type Accum = {
    n_corsi_formatore: number
    ore_formatore: number
    n_corsi_tutor: number
    ore_tutor: number
    tot_ore: number
    tot_pian: number
  }
  const acc = new Map<string, Accum>()

  const empty = (): Accum => ({
    n_corsi_formatore: 0, ore_formatore: 0,
    n_corsi_tutor: 0, ore_tutor: 0,
    tot_ore: 0, tot_pian: 0,
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

  // Build response: { [userId]: UtenteStats }
  const result: Record<string, UtenteStats> = {}
  for (const [uid, s] of acc) {
    result[uid] = {
      n_corsi_formatore: s.n_corsi_formatore,
      ore_formatore: s.ore_formatore,
      n_corsi_tutor: s.n_corsi_tutor,
      ore_tutor: s.ore_tutor,
      pct: s.tot_ore > 0 ? Math.round((s.tot_pian / s.tot_ore) * 100) : 0,
    }
  }

  return NextResponse.json(result)
}
