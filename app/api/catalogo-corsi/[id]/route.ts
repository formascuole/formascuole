import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if ('titolo' in body) {
    if (!body.titolo?.trim()) return NextResponse.json({ error: 'Titolo obbligatorio' }, { status: 400 })
    updates.titolo = body.titolo.trim()
  }
  if ('tipo' in body) {
    if (!['PF', 'Lab'].includes(body.tipo)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })
    updates.tipo = body.tipo
  }
  if ('descrizione' in body) updates.descrizione = body.descrizione?.trim() || null
  if ('link_scheda' in body) updates.link_scheda = body.link_scheda?.trim() || null
  if ('attivo' in body) updates.attivo = Boolean(body.attivo)

  const { data, error } = await supabase
    .from('catalogo_corsi')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!await checkIsSuperAdmin(user.id)) {
    return NextResponse.json({ error: 'Solo il Super Admin può eliminare dal catalogo' }, { status: 403 })
  }

  const { error } = await supabase.from('catalogo_corsi').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
