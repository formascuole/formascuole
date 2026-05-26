import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('catalogo_corsi')
    .select('*')
    .order('titolo')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { titolo, tipo, descrizione, link_scheda, attivo } = await request.json()

  if (!titolo?.trim()) return NextResponse.json({ error: 'Titolo obbligatorio' }, { status: 400 })
  if (!['PF', 'Lab'].includes(tipo)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })

  const { data, error } = await supabase
    .from('catalogo_corsi')
    .insert({
      titolo: titolo.trim(),
      tipo,
      descrizione: descrizione?.trim() || null,
      link_scheda: link_scheda?.trim() || null,
      attivo: attivo ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
