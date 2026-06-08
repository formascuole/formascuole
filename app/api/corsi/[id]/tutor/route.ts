import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { tutor_id } = await request.json()
  console.log(`[tutor/route] PATCH corso=${id} tutor_id=${tutor_id ?? 'null'} caller=${user.id}`)

  // Use admin client to bypass RLS — auth check above already verified the caller is admin
  const adminClient = createAdminClient()

  // Fetch tutor's default tariffa AND current corso's tariffa to avoid overwriting
  let tariffaTutor: number | null = null
  let tariffaTutorGiaImpostata = false
  if (tutor_id) {
    const [{ data: tp }, { data: currentCorso }] = await Promise.all([
      adminClient.from('profiles').select('tariffa_oraria_tutor').eq('id', tutor_id).single(),
      adminClient.from('corsi').select('tariffa_oraria_tutor').eq('id', id).single(),
    ])
    tariffaTutor = tp?.tariffa_oraria_tutor != null ? Number(tp.tariffa_oraria_tutor) : null
    tariffaTutorGiaImpostata = currentCorso?.tariffa_oraria_tutor != null
  }

  const { data, error } = await adminClient
    .from('corsi')
    .update({
      tutor_id: tutor_id || null,
      // Only pre-fill from profile if corso doesn't already have a custom rate
      ...(tutor_id && tariffaTutor != null && !tariffaTutorGiaImpostata ? { tariffa_oraria_tutor: tariffaTutor } : {}),
    })
    .eq('id', id)
    .select('*, tutor:profiles!tutor_id(id,nome,email,avatar_initials)')
    .single()

  if (error) {
    console.error(`[tutor/route] UPDATE error for corso=${id}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[tutor/route] UPDATE ok, tutor_id now=${(data as { tutor_id?: string | null }).tutor_id ?? 'null'}`)
  return NextResponse.json(data)
}
