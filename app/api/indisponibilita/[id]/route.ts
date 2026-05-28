import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: ind } = await admin
    .from('indisponibilita_formatori')
    .select('formatore_id, data')
    .eq('id', id)
    .single()
  if (!ind) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(profile?.role)

  if (!isAdmin && ind.formatore_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isAdmin) {
    const today = new Date().toISOString().split('T')[0]
    if (ind.data < today) {
      return NextResponse.json({ error: 'Non puoi eliminare indisponibilità passate' }, { status: 400 })
    }
  }

  const { error } = await admin.from('indisponibilita_formatori').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
