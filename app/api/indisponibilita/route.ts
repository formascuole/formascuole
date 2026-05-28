import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, fascia, note } = body

  if (!data) return NextResponse.json({ error: 'Data obbligatoria' }, { status: 400 })
  if (!['mattina', 'pomeriggio', 'tutto_il_giorno'].includes(fascia)) {
    return NextResponse.json({ error: 'Fascia non valida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: created, error } = await admin
    .from('indisponibilita_formatori')
    .insert({
      formatore_id: user.id,
      data,
      fascia,
      note: note?.trim() || null,
    })
    .select('id, formatore_id, data, fascia, note, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await admin.from('profiles').select('id, nome').eq('id', user.id).single()
  return NextResponse.json({ ...created, formatore_nome: profile?.nome || null }, { status: 201 })
}
