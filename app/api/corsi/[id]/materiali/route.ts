import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/corsi/[id]/materiali — list materials (public: no auth check, used by portal)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('materiali_corso')
    .select('*')
    .eq('corso_id', id)
    .order('ordine')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/corsi/[id]/materiali — add a material (admin or formatore)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!['admin', 'super_admin', 'formatore'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { nome, tipo, url, descrizione, ordine } = body
  if (!nome?.trim() || !tipo || !url?.trim()) {
    return NextResponse.json({ error: 'nome, tipo e url sono obbligatori' }, { status: 400 })
  }
  if (!['file', 'link'].includes(tipo)) {
    return NextResponse.json({ error: 'tipo deve essere file o link' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('materiali_corso')
    .insert({
      corso_id: id,
      caricato_da: user.id,
      nome: nome.trim(),
      tipo,
      url: url.trim(),
      descrizione: descrizione?.trim() || null,
      ordine: Number(ordine) || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/corsi/[id]/materiali — remove a material (admin or uploader)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!['admin', 'super_admin', 'formatore'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { materiale_id } = body
  if (!materiale_id) return NextResponse.json({ error: 'materiale_id obbligatorio' }, { status: 400 })

  const admin = createAdminClient()
  const { data: mat } = await admin
    .from('materiali_corso')
    .select('corso_id, caricato_da, tipo, url')
    .eq('id', materiale_id)
    .single()

  if (!mat || mat.corso_id !== id) {
    return NextResponse.json({ error: 'Materiale non trovato' }, { status: 404 })
  }

  const isAdmin = ['admin', 'super_admin'].includes(role)
  if (!isAdmin && mat.caricato_da !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If stored in bucket, delete the object
  if (mat.tipo === 'file' && mat.url.includes('materiali-corso')) {
    const path = mat.url.split('/materiali-corso/')[1]
    if (path) await admin.storage.from('materiali-corso').remove([path])
  }

  const { error } = await admin.from('materiali_corso').delete().eq('id', materiale_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
