import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  // Check if used
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    admin.from('corsi_tags').select('*', { count: 'exact', head: true }).eq('tag_id', id),
    admin.from('formatori_skills').select('*', { count: 'exact', head: true }).eq('tag_id', id),
  ])
  if ((c1 ?? 0) > 0 || (c2 ?? 0) > 0) {
    return NextResponse.json({ error: `Tag in uso (${(c1 ?? 0) + (c2 ?? 0)} assegnazioni). Rimuovilo da tutti i corsi e formatori prima di eliminarlo.` }, { status: 409 })
  }
  await admin.from('tags').delete().eq('id', id)
  return new NextResponse(null, { status: 204 })
}
