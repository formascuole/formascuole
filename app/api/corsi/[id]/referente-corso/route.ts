import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(profile?.role)
  const isFormatore = profile?.role === 'formatore'

  if (!isAdmin && !isFormatore) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  if (isFormatore) {
    const { data: corsoCheck } = await admin.from('corsi').select('formatore_id').eq('id', id).single()
    if (corsoCheck?.formatore_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('referente_corso_nome' in body) updates.referente_corso_nome = body.referente_corso_nome?.trim() || null
  if ('referente_corso_email' in body) updates.referente_corso_email = body.referente_corso_email?.trim() || null
  if ('referente_corso_telefono' in body) updates.referente_corso_telefono = body.referente_corso_telefono?.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const { data, error } = await admin.from('corsi').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
