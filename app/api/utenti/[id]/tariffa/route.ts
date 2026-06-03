import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin'].includes(callerProfile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if ('tariffa_oraria_formatore' in body) {
    const v = body.tariffa_oraria_formatore
    updates.tariffa_oraria_formatore = v !== null && v !== '' ? Number(v) : null
  }
  if ('tariffa_oraria_tutor' in body) {
    const v = body.tariffa_oraria_tutor
    updates.tariffa_oraria_tutor = v !== null && v !== '' ? Number(v) : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', targetId)
    .select('id, tariffa_oraria_formatore, tariffa_oraria_tutor')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
