import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/corsi/search?q=... — ricerca corsi per admin (genera attestato manuale)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const admin = createAdminClient()

  // Supabase PostgREST non supporta .or() su colonne di tabelle join,
  // quindi eseguiamo due query separate e uniamo i risultati.

  // 1. Ricerca per titolo corso
  const { data: byTitle, error: e1 } = await admin
    .from('corsi')
    .select('id, title, progetti(school_name)')
    .ilike('title', `%${q}%`)
    .order('title', { ascending: true })
    .limit(20)

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // 2. Ricerca progetti per school_name, poi recupera i corsi
  const { data: progettiMatch } = await admin
    .from('progetti')
    .select('id')
    .ilike('school_name', `%${q}%`)
    .limit(20)

  const progettiIds = (progettiMatch ?? []).map((p: { id: string }) => p.id)

  let bySchool: typeof byTitle = []
  if (progettiIds.length > 0) {
    const { data: s } = await admin
      .from('corsi')
      .select('id, title, progetti(school_name)')
      .in('project_id', progettiIds)
      .order('title', { ascending: true })
      .limit(20)
    bySchool = s ?? []
  }

  // Unisci e deduplica per id
  const seen = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = [...(byTitle ?? []), ...bySchool].filter((c: any) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  }).slice(0, 20)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = merged.map((c: any) => ({
    id: c.id as string,
    title: c.title as string,
    school_name: (c.progetti?.school_name ?? '') as string,
  }))

  return NextResponse.json(results)
}
