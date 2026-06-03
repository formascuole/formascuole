import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { maybeNotificaCalendarioCompleto } from '@/lib/notifiche-corso'

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
  const { corso_id, data: sessioneData, ore: oreBody, ora_inizio, ora_fine, modalita_sessione } = body

  if (!corso_id || !sessioneData) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // ore can be derived from ora_inizio/ora_fine
  let ore = oreBody
  if (!ore && ora_inizio && ora_fine) {
    const [sh, sm] = (ora_inizio as string).split(':').map(Number)
    const [eh, em] = (ora_fine as string).split(':').map(Number)
    const diffMin = (eh * 60 + em) - (sh * 60 + sm)
    if (diffMin > 0) ore = Math.round((diffMin / 60) * 2) / 2
  }

  if (!ore || Number(ore) <= 0) {
    return NextResponse.json({ error: 'Ore obbligatorie o non valide' }, { status: 400 })
  }

  // Validate ore residue
  const { data: corso } = await supabase
    .from('corsi_con_ore')
    .select('ore_residue, formatore_id, tipo, modalita')
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

  // modalita_sessione obbligatoria per corsi PF ibridi
  if (corso.tipo === 'PF' && corso.modalita === 'ibrido' && !modalita_sessione) {
    return NextResponse.json(
      { error: 'La modalità sessione è obbligatoria per i corsi ibridi' },
      { status: 400 }
    )
  }

  const insertData: Record<string, unknown> = { corso_id, data: sessioneData, ore: Number(ore) }
  if (modalita_sessione) insertData.modalita_sessione = modalita_sessione
  if (ora_inizio) insertData.ora_inizio = ora_inizio
  if (ora_fine) insertData.ora_fine = ora_fine

  const { data, error } = await supabase
    .from('sessioni')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notifica calendario completo (fire-and-forget, non blocca la risposta)
  maybeNotificaCalendarioCompleto(corso_id).catch(err =>
    console.error('[notifica] Errore calendario completo (POST sessione):', err)
  )

  return NextResponse.json(data, { status: 201 })
}
