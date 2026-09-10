import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function replicaReferenteAiCorsi(
  referenteId: string,
  progettoId: string,
  email: string
): Promise<number> {
  const admin = createAdminClient()
  const { data: corsi } = await admin
    .from('corsi')
    .select('id, referente_corso_email')
    .eq('progetto_id', progettoId)
    .is('referente_id', null)

  if (!corsi || corsi.length === 0) return 0

  const emailLower = email.toLowerCase()
  const toUpdate = corsi
    .filter(c => c.referente_corso_email?.toLowerCase() !== emailLower)
    .map(c => c.id)

  if (toUpdate.length === 0) return 0

  await admin.from('corsi').update({ referente_id: referenteId }).in('id', toUpdate)
  return toUpdate.length
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) return null
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { nome, email, tel, ruolo } = await request.json()
  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'nome ed email sono obbligatori' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('referenti_progetto')
    .update({ nome: nome.trim(), email: email.trim(), tel: tel?.trim() || null, ruolo: ruolo?.trim() || null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const replicated_to = await replicaReferenteAiCorsi(data.id, data.progetto_id, data.email).catch(() => 0)
  return NextResponse.json({ ...data, replicated_to })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('referenti_progetto').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
