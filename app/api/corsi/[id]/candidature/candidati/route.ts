import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'formatore')
    return NextResponse.json({ error: 'Solo i formatori possono candidarsi' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { note?: string }

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi').select('candidature_aperte, formatore_id').eq('id', corsoId).single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (!corso.candidature_aperte) return NextResponse.json({ error: 'Candidature non aperte' }, { status: 400 })
  if (corso.formatore_id) return NextResponse.json({ error: 'Corso già assegnato' }, { status: 400 })

  const { error } = await admin.from('candidature_corsi').insert({
    corso_id: corsoId,
    formatore_id: user.id,
    note: body.note?.trim() || null,
  })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Già candidato per questo corso' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
