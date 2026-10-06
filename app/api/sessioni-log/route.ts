import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const corsoId = searchParams.get('corso_id')
  const projectId = searchParams.get('project_id')
  if (!corsoId && !projectId) return NextResponse.json({ error: 'corso_id or project_id required' }, { status: 400 })

  const adminQ = createAdminClient()

  if (projectId) {
    // Fetch all corsi for the project, then all their logs in one query
    const { data: corsiRaw } = await adminQ
      .from('corsi')
      .select('id, title')
      .eq('project_id', projectId)
    const corsi: { id: string; title: string }[] = corsiRaw || []
    const corsiIds = corsi.map(c => c.id)
    const corsoTitleMap = new Map(corsi.map(c => [c.id, c.title]))

    if (corsiIds.length === 0) return NextResponse.json([])

    const { data, error } = await adminQ
      .from('sessioni_log')
      .select('*, utente:profiles!utente_id(id, nome, role, avatar_initials)')
      .in('corso_id', corsiIds)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const enriched = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      corso_title: corsoTitleMap.get(row.corso_id as string) ?? null,
    }))
    return NextResponse.json(enriched)
  }

  const { data, error } = await adminQ
    .from('sessioni_log')
    .select('*, utente:profiles!utente_id(id, nome, role, avatar_initials)')
    .eq('corso_id', corsoId!)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
