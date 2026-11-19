/**
 * GET /api/dm219/[progettoId]
 * Dettaglio monitoraggio DM 219/2025 per un singolo progetto.
 *
 * PATCH /api/dm219/[progettoId]
 * Salva/aggiorna i parametri override (tutor_riconosciuto, base_quota_lab,
 * corsi_inclusi, corsi_esclusi) nella tabella dm219_params.
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

async function requireAdmin(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
    return { user: null, error: 'Forbidden', status: 403 }
  }
  return { user, error: null, status: 200 }
}

async function buildCorsiInput(
  admin: ReturnType<typeof createAdminClient>,
  progettoId: string,
): Promise<CorsoInput[]> {
  const oggi = new Date().toISOString().slice(0, 10)

  const { data: corsiDb, error } = await admin
    .from('corsi')
    .select(`
      id, tipo, ore_totali, formatore_id,
      sessioni ( id, data, ore, completata )
    `)
    .eq('project_id', progettoId)

  if (error) throw new Error(error.message)

  return (corsiDb ?? []).map(c => {
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
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ progettoId: string }> },
) {
  try {
    const { progettoId } = await params
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()

    // Dati progetto
    const { data: progetto, error: pe } = await admin
      .from('progetti')
      .select('id, school_name, status, finanziamento_id')
      .eq('id', progettoId)
      .single()
    if (pe || !progetto) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 })

    // Parametri override
    const { data: paramsRow } = await admin
      .from('dm219_params')
      .select('*')
      .eq('progetto_id', progettoId)
      .single()

    const paramsOverride: Partial<Dm219Params> = {}
    const corsi_inclusi: string[] = paramsRow?.corsi_inclusi ?? []
    const corsi_esclusi: string[] = paramsRow?.corsi_esclusi ?? []
    if (paramsRow?.tutor_riconosciuto !== undefined) paramsOverride.tutor_riconosciuto = paramsRow.tutor_riconosciuto
    if (paramsRow?.base_quota_lab) paramsOverride.base_quota_lab = paramsRow.base_quota_lab

    // Corsi e sessioni
    const corsiInput = await buildCorsiInput(admin, progettoId)

    // Calcola
    const risultato = calcolaProgettoDm219(
      corsiInput, paramsOverride, corsi_inclusi, corsi_esclusi
    )

    return NextResponse.json({
      progetto: {
        id: progetto.id,
        school_name: progetto.school_name,
        status: progetto.status,
        finanziamento_id: progetto.finanziamento_id,
      },
      params_override: paramsRow ? {
        tutor_riconosciuto: paramsRow.tutor_riconosciuto,
        base_quota_lab: paramsRow.base_quota_lab,
        corsi_inclusi,
        corsi_esclusi,
      } : null,
      ...risultato,
    })
  } catch (e) {
    console.error('[/api/dm219/[progettoId]] GET error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ progettoId: string }> },
) {
  try {
    const { progettoId } = await params
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json() as {
      tutor_riconosciuto?: boolean
      base_quota_lab?: 'realizzato' | 'accordato'
      corsi_inclusi?: string[]
      corsi_esclusi?: string[]
    }

    const admin = createAdminClient()

    const { error } = await admin
      .from('dm219_params')
      .upsert({
        progetto_id: progettoId,
        ...(body.tutor_riconosciuto !== undefined && { tutor_riconosciuto: body.tutor_riconosciuto }),
        ...(body.base_quota_lab && { base_quota_lab: body.base_quota_lab }),
        ...(body.corsi_inclusi !== undefined && { corsi_inclusi: body.corsi_inclusi }),
        ...(body.corsi_esclusi !== undefined && { corsi_esclusi: body.corsi_esclusi }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'progetto_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Ricalcola e ritorna risultato aggiornato
    const { data: paramsRow } = await admin
      .from('dm219_params').select('*').eq('progetto_id', progettoId).single()

    const paramsOverride: Partial<Dm219Params> = {}
    const corsi_inclusi: string[] = paramsRow?.corsi_inclusi ?? []
    const corsi_esclusi: string[] = paramsRow?.corsi_esclusi ?? []
    if (paramsRow?.tutor_riconosciuto !== undefined) paramsOverride.tutor_riconosciuto = paramsRow.tutor_riconosciuto
    if (paramsRow?.base_quota_lab) paramsOverride.base_quota_lab = paramsRow.base_quota_lab

    const corsiInput = await buildCorsiInput(admin, progettoId)
    const risultato = calcolaProgettoDm219(corsiInput, paramsOverride, corsi_inclusi, corsi_esclusi)

    return NextResponse.json({ success: true, ...risultato })
  } catch (e) {
    console.error('[/api/dm219/[progettoId]] PATCH error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
