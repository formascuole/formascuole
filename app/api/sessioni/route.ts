import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const corsoId = searchParams.get('corso_id')

  if (!corsoId) return NextResponse.json({ error: 'corso_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sessioni')
    .select('*')
    .eq('corso_id', corsoId)
    .order('data')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { corso_id, data: sessioneData, ore } = body

  if (!corso_id || !sessioneData || !ore) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate ore residue
  const { data: corso } = await supabase
    .from('corsi_con_ore')
    .select('ore_residue, formatore_id')
    .eq('id', corso_id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso not found' }, { status: 404 })

  // Permission check: admin OR assigned formatore
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const isAssignedFormatore = corso.formatore_id === user.id

  if (!isAdmin && !isAssignedFormatore) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (Number(ore) > Number(corso.ore_residue)) {
    return NextResponse.json(
      { error: `Ore (${ore}) exceed remaining hours (${corso.ore_residue})` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('sessioni')
    .insert({ corso_id, data: sessioneData, ore: Number(ore) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
