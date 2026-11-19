/**
 * GET /api/dm219
 * Restituisce l'elenco di tutti i progetti DM 219/2025 con il semaforo.
 * Solo admin/super_admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calcolaProgettoDm219,
  type CorsoInput,
  type Dm219Params,
} from '@/lib/dm219/calcoli'

// Identifica i finanziamenti DM 219/2025 per nome (case-insensitive)
function isDm219(nome: string): boolean {
  return /219.*(2025)?|DM.*219/i.test(nome)
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()

    // 1. Tutti i finanziamenti per trovare quelli DM 219
    const { data: finanziamenti } = await admin.from('finanziamenti').select('id, nome')
    const dm219Ids = new Set(
      (finanziamenti ?? [])
        .filter(f => isDm219(f.nome))
        .map(f => f.id)
    )

    if (dm219Ids.size === 0) {
      return NextResponse.json([])
    }

    // 2. Progetti con quel finanziamento
    const { data: progetti, error: pe } = await admin
      .from('progetti')
      .select('id, school_name, finanziamento_id, status')
      .in('finanziamento_id', [...dm219Ids])
      .order('school_name')

    if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })
    if (!progetti || progetti.length === 0) return NextResponse.json([])

    // 3. Per ogni progetto, calcola il monitoraggio
    const oggi = new Date().toISOString().slice(0, 10)
    const progettoIds = progetti.map(p => p.id)

    // Corsi con ore erogate e pianificate
    const { data: corsiRaw, error: ce } = await admin
      .from('corsi')
      .select(`
        id, project_id, tipo, ore_totali, formatore_id,
        sessioni ( id, data, ore, completata )
      `)
      .in('project_id', progettoIds)

    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })

    // Parametri override per progetto
    const { data: paramsRaw } = await admin
      .from('dm219_params')
      .select('*')
      .in('progetto_id', progettoIds)

    const paramsMap = new Map<string, Partial<Dm219Params> & {
      corsi_inclusi: string[]; corsi_esclusi: string[]
    }>()
    for (const p of paramsRaw ?? []) {
      paramsMap.set(p.progetto_id, {
        tutor_riconosciuto: p.tutor_riconosciuto,
        base_quota_lab: p.base_quota_lab,
        corsi_inclusi: p.corsi_inclusi ?? [],
        corsi_esclusi: p.corsi_esclusi ?? [],
      })
    }

    // Raggruppa corsi per progetto
    const corsiPerProgetto = new Map<string, typeof corsiRaw>()
    for (const c of corsiRaw ?? []) {
      const pid = c.project_id as string
      if (!corsiPerProgetto.has(pid)) corsiPerProgetto.set(pid, [])
      corsiPerProgetto.get(pid)!.push(c)
    }

    // Calcola ogni progetto
    const risultati = progetti.map(p => {
      const corsiDb = corsiPerProgetto.get(p.id) ?? []
      const override = paramsMap.get(p.id)

      const corsiInput: CorsoInput[] = corsiDb.map(c => {
        const sessioni = (c.sessioni as any[]) ?? []
        const ore_erogate = sessioni
          .filter(s => s.completata)
          .reduce((a: number, s: any) => a + Number(s.ore), 0)
        const ore_pianificate = sessioni
          .filter(s => !s.completata && (s.data as string) >= oggi)
          .reduce((a: number, s: any) => a + Number(s.ore), 0)
        const sessioni_scadute_non_erogate = sessioni
          .filter(s => !s.completata && (s.data as string) < oggi).length
        const corso_completato = ore_erogate >= Number(c.ore_totali)

        return {
          id: c.id,
          tipo: c.tipo as CorsoInput['tipo'],
          ore_totali: Number(c.ore_totali),
          ore_erogate,
          ore_pianificate,
          formatore_id: c.formatore_id as string | null,
          corso_completato,
          sessioni_scadute_non_erogate,
        }
      })

      const { corsi_inclusi, corsi_esclusi, ...paramsOverride } = override ?? {
        corsi_inclusi: [], corsi_esclusi: []
      }

      const risultato = calcolaProgettoDm219(
        corsiInput, paramsOverride, corsi_inclusi ?? [], corsi_esclusi ?? []
      )

      return {
        progetto_id: p.id,
        school_name: p.school_name,
        status: p.status,
        semaforo: risultato.semaforo,
        pct_ore: risultato.pct_ore_erogate,
        pct_valore: risultato.pct_valore_erogato,
        ore_previste: risultato.totale.ore_previste,
        ore_erogate: risultato.totale.ore_erogate,
        ore_mancanti_pf: risultato.ore_mancanti_pf,
        ore_mancanti_lab: risultato.ore_mancanti_lab,
        quota_lab_pct: risultato.scenario.quota_lab_pct,
        n_segnalazioni: risultato.n_segnalazioni,
        scenario_valido: risultato.scenario.valido,
      }
    })

    return NextResponse.json(risultati)
  } catch (e) {
    console.error('[/api/dm219] Unexpected error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
