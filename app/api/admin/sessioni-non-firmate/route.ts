import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/sessioni-non-firmate
// Restituisce le sessioni passate non firmate (completata = false/null)
// escludendo i corsi completamente erogati
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('sessioni')
    .select(`
      id, data, ora_inizio, ore,
      corsi!corso_id(
        id, title, corso_completato,
        profiles!formatore_id(id, nome, email),
        progetti!project_id(id, school_name, anno_scolastico)
      )
    `)
    .lt('data', today)
    .or('completata.is.null,completata.eq.false')
    .order('data', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Escludi sessioni di corsi completamente erogati
  const filtered = (data || []).filter((s: Record<string, unknown>) => {
    const corsi = s.corsi as { corso_completato?: boolean } | null
    return !corsi?.corso_completato
  })

  // Raggruppa per scuola → corso → sessioni
  const byScuola: Record<string, {
    school_name: string
    corsi: Record<string, {
      corso_id: string
      corso_title: string
      formatore: string | null
      formatore_email: string | null
      sessioni: { id: string; data: string; ora_inizio: string | null; ore: number }[]
    }>
  }> = {}

  for (const s of filtered as Record<string, unknown>[]) {
    const corsi = s.corsi as Record<string, unknown> | null
    const progetto = corsi?.progetti as Record<string, unknown> | null
    const formatoreRec = corsi?.profiles as Record<string, unknown> | null

    const scuolaId = (progetto?.id as string) ?? 'sconosciuta'
    const scuolaNome = (progetto?.school_name as string) ?? '—'
    const corsoId = (corsi?.id as string) ?? '—'
    const corsoTitle = (corsi?.title as string) ?? '—'
    const formatore = (formatoreRec?.nome as string) ?? null
    const formatoreEmail = (formatoreRec?.email as string) ?? null

    if (!byScuola[scuolaId]) byScuola[scuolaId] = { school_name: scuolaNome, corsi: {} }
    if (!byScuola[scuolaId].corsi[corsoId]) {
      byScuola[scuolaId].corsi[corsoId] = {
        corso_id: corsoId,
        corso_title: corsoTitle,
        formatore,
        formatore_email: formatoreEmail,
        sessioni: [],
      }
    }
    byScuola[scuolaId].corsi[corsoId].sessioni.push({
      id: s.id as string,
      data: s.data as string,
      ora_inizio: s.ora_inizio as string | null,
      ore: s.ore as number,
    })
  }

  return NextResponse.json({
    data_riferimento: today,
    totale_sessioni: filtered.length,
    scuole: Object.values(byScuola)
      .sort((a, b) => a.school_name.localeCompare(b.school_name))
      .map(sc => ({
        school_name: sc.school_name,
        corsi: Object.values(sc.corsi),
      })),
  })
}
