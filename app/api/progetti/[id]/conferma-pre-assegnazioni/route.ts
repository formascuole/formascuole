import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: progettoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { corso_ids } = await request.json() as { corso_ids: string[] }
  if (!corso_ids?.length) return NextResponse.json({ success: true })

  const admin = createAdminClient()

  // Confirm pre-assignments: mark as definitive (not pre-assigned, not yet notified)
  const { error } = await admin
    .from('corsi')
    .update({ pre_assegnazione: false, notificato: false })
    .in('id', corso_ids)
    .eq('project_id', progettoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
