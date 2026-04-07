import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const corso_id = searchParams.get('corso_id')
  if (!corso_id) return NextResponse.json({ error: 'corso_id obbligatorio' }, { status: 400 })

  const { data, error } = await supabase
    .from('note_corso')
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .eq('corso_id', corso_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { corso_id, testo } = await request.json()
  if (!corso_id || !testo?.trim()) {
    return NextResponse.json({ error: 'corso_id e testo sono obbligatori' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('note_corso')
    .insert({ corso_id, autore_id: user.id, testo: testo.trim() })
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
