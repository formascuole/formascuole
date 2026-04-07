import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const progetto_id = searchParams.get('progetto_id')
  if (!progetto_id) return NextResponse.json({ error: 'progetto_id obbligatorio' }, { status: 400 })

  const { data, error } = await supabase
    .from('chat_messaggi')
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .eq('progetto_id', progetto_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch which messages this user has already read
  const ids = (data || []).map(m => m.id)
  let readSet = new Set<string>()
  if (ids.length > 0) {
    const { data: letture } = await supabase
      .from('chat_letture')
      .select('messaggio_id')
      .eq('utente_id', user.id)
      .in('messaggio_id', ids)
    readSet = new Set((letture || []).map(l => l.messaggio_id))
  }

  const messaggi = (data || []).map(m => ({
    ...m,
    letto: readSet.has(m.id),
  }))

  return NextResponse.json(messaggi)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { progetto_id, testo } = await request.json()
  if (!progetto_id || !testo?.trim()) {
    return NextResponse.json({ error: 'progetto_id e testo sono obbligatori' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('chat_messaggi')
    .insert({ progetto_id, autore_id: user.id, testo: testo.trim() })
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-mark as read for the sender
  await supabase
    .from('chat_letture')
    .insert({ messaggio_id: data.id, utente_id: user.id })
    .select()

  return NextResponse.json({ ...data, letto: true }, { status: 201 })
}
