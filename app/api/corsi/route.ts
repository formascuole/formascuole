import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  let query = supabase
    .from('corsi_con_ore')
    .select('*, formatore:profiles(id,nome,email,avatar_initials)')
    .order('created_at')

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { project_id, title, tipo, ore_totali, modalita, tutor_previsto, tutor_nome, ore_tutoraggio } = body

  if (!project_id || !title || !tipo || !ore_totali) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (tipo === 'PF' && !modalita) {
    return NextResponse.json({ error: 'La modalità è obbligatoria per i corsi PF' }, { status: 400 })
  }

  const insertData: Record<string, unknown> = {
    project_id, title, tipo, ore_totali: Number(ore_totali),
    tutor_previsto: Boolean(tutor_previsto),
  }
  if (modalita) insertData.modalita = modalita
  if (tutor_previsto && tutor_nome) insertData.tutor_nome = tutor_nome
  if (tutor_previsto && ore_tutoraggio) insertData.ore_tutoraggio = Number(ore_tutoraggio)

  const { data, error } = await supabase
    .from('corsi')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
