import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('progetti')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only super_admin can delete projects
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Riservato al Super Admin' }, { status: 403 })

  const admin = createAdminClient()

  // Collect corso IDs for cascade
  const { data: corsi } = await admin.from('corsi').select('id').eq('project_id', id)
  const corsoIds = (corsi || []).map((c: { id: string }) => c.id)

  if (corsoIds.length > 0) {
    await admin.from('note_corso').delete().in('corso_id', corsoIds)
    await admin.from('sessioni').delete().in('corso_id', corsoIds)
    await admin.from('solleciti_log').delete().in('corso_id', corsoIds)
  }
  await admin.from('chat_messaggi').delete().eq('progetto_id', id)
  await admin.from('chat_letture').delete().in('messaggio_id',
    // chat_letture references chat_messaggi which we already deleted — this is a no-op but safe
    []
  )
  await admin.from('corsi').delete().eq('project_id', id)
  await admin.from('referenti_progetto').delete().eq('progetto_id', id)

  const { error } = await admin.from('progetti').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
