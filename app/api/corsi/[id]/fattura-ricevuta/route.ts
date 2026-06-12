import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const fattura_ricevuta: boolean = body.fattura_ricevuta

  const admin = createAdminClient()
  const updateData: Record<string, unknown> = { fattura_ricevuta }
  if (fattura_ricevuta) {
    updateData.fattura_ricevuta_at = new Date().toISOString()
  } else {
    updateData.fattura_ricevuta_at = null
  }

  const { error } = await admin.from('corsi').update(updateData).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
