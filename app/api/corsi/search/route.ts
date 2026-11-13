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
  const { data, error } = await admin
    .from('corsi')
    .select('id, title, progetti(school_name)')
    .or(`title.ilike.%${q}%,progetti.school_name.ilike.%${q}%`)
    .order('title', { ascending: true })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = (data ?? []).map((c: { id: string; title: string; progetti: { school_name: string } | null }) => ({
    id: c.id,
    title: c.title,
    school_name: (c.progetti as { school_name: string } | null)?.school_name ?? '',
  }))

  return NextResponse.json(results)
}
