import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: superAdminRow } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', user.id)
    .eq('role', 'super_admin')
    .maybeSingle()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin' && !superAdminRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.nome !== undefined) updates.nome = body.nome.trim()
  if (body.descrizione !== undefined) updates.descrizione = body.descrizione?.trim() || null
  if (body.attivo !== undefined) updates.attivo = body.attivo
  if ('tariffa_formatore_ora' in body) updates.tariffa_formatore_ora = body.tariffa_formatore_ora != null && body.tariffa_formatore_ora !== '' ? Number(body.tariffa_formatore_ora) : null
  if ('tariffa_tutor_ora' in body) updates.tariffa_tutor_ora = body.tariffa_tutor_ora != null && body.tariffa_tutor_ora !== '' ? Number(body.tariffa_tutor_ora) : null
  if ('data_termine' in body) updates.data_termine = body.data_termine || null

  const { data, error } = await supabase
    .from('finanziamenti')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
