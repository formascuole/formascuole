import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('corsi_tags').select('tag:tags(id,nome,colore)').eq('corso_id', corsoId)
  return NextResponse.json((data || []).map((r: any) => r.tag).filter(Boolean))
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { tag_id } = await request.json()
  if (!tag_id) return NextResponse.json({ error: 'tag_id obbligatorio' }, { status: 400 })
  const admin = createAdminClient()
  await admin.from('corsi_tags').upsert({ corso_id: corsoId, tag_id }, { onConflict: 'corso_id,tag_id' })
  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { tag_id } = await request.json()
  if (!tag_id) return NextResponse.json({ error: 'tag_id obbligatorio' }, { status: 400 })
  const admin = createAdminClient()
  await admin.from('corsi_tags').delete().eq('corso_id', corsoId).eq('tag_id', tag_id)
  return new NextResponse(null, { status: 204 })
}
