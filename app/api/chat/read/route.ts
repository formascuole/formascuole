import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Mark messages as read
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messaggio_ids } = await request.json()
  if (!Array.isArray(messaggio_ids) || messaggio_ids.length === 0) {
    return NextResponse.json({ error: 'messaggio_ids array obbligatorio' }, { status: 400 })
  }

  const rows = messaggio_ids.map((id: string) => ({
    messaggio_id: id,
    utente_id: user.id,
  }))

  const { error } = await supabase
    .from('chat_letture')
    .upsert(rows, { onConflict: 'messaggio_id,utente_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
