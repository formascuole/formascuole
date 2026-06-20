import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('link_scheda' in body) updates.link_scheda = body.link_scheda?.trim() || null
  if ('descrizione' in body) updates.descrizione = body.descrizione?.trim() || null
  if ('tariffa_oraria' in body) {
    const t = body.tariffa_oraria
    updates.tariffa_oraria = t !== null && t !== '' ? Number(t) : null
  }
  if ('tariffa_oraria_tutor' in body) {
    const t = body.tariffa_oraria_tutor
    updates.tariffa_oraria_tutor = t !== null && t !== '' ? Number(t) : null
  }
  if ('edizione' in body) updates.edizione = body.edizione?.trim() || null
  if ('note' in body) updates.note = body.note?.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('corsi').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

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
