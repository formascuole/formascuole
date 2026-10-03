import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/materiali-accesso — register participant access (no auth)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { corso_id, nome, cognome, email } = body

  if (!corso_id || !nome?.trim() || !cognome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Dati incompleti' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('accessi_materiali')
    .insert({
      corso_id,
      nome: nome.trim(),
      cognome: cognome.trim(),
      email: email.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
