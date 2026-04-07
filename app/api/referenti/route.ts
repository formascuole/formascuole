import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const progetto_id = request.nextUrl.searchParams.get('progetto_id')
  if (!progetto_id) return NextResponse.json({ error: 'progetto_id obbligatorio' }, { status: 400 })

  const { data, error } = await supabase
    .from('referenti_progetto')
    .select('*')
    .eq('progetto_id', progetto_id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { progetto_id, nome, email, tel } = await request.json()
  if (!progetto_id || !nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'progetto_id, nome ed email sono obbligatori' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('referenti_progetto')
    .insert({ progetto_id, nome: nome.trim(), email: email.trim(), tel: tel?.trim() || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
