import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only super_admin can delete courses
  if (!await checkIsSuperAdmin(user.id)) return NextResponse.json({ error: 'Riservato al Super Admin' }, { status: 403 })

  const admin = createAdminClient()

  // Cascade delete
  await admin.from('note_corso').delete().eq('corso_id', id)
  await admin.from('sessioni').delete().eq('corso_id', id)
  await admin.from('solleciti_log').delete().eq('corso_id', id)

  const { error } = await admin.from('corsi').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
