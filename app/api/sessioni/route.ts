import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Validate ore residue — use admin client to bypass RLS on the view
  const admin = createAdminClient()
  const { data: corso } = await admin
    .from('corsi_con_ore')
    .select('ore_residue, formatore_id, tipo, modalita, project_id, finanziamento_id')
    .eq('id', corso_id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso not found' }, { status: 404 })

  // Permission check: admin OR assigned formatore
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
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

  // ── CHECK 1: Data termine finanziamento ──────────────────────────────────────
  const finId = (corso as any).finanziamento_id as string | null
  if (!finId) {
    // Check progetto's finanziamento_id
    const { data: progetto } = await admin
      .from('progetti')
      .select('finanziamento_id')
      .eq('id', (corso as any).project_id as string)
      .single()
    if (progetto?.finanziamento_id) {
      const { data: fin } = await admin
        .from('finanziamenti')
        .select('nome, data_termine')
        .eq('id', progetto.finanziamento_id)
        .single()
      if (fin?.data_termine && sessioneData > fin.data_termine) {
        const dataFmt = new Date(fin.data_termine + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        return NextResponse.json(
          { error: `Non è possibile inserire sessioni oltre la data di termine prevista per il finanziamento ${fin.nome} (${dataFmt}).` },
          { status: 400 }
        )
      }
    }
  } else {
    const { data: fin } = await admin
      .from('finanziamenti')
      .select('nome, data_termine')
      .eq('id', finId)
      .single()
    if (fin?.data_termine && sessioneData > fin.data_termine) {
      const dataFmt = new Date(fin.data_termine + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      return NextResponse.json(
        { error: `Non è possibile inserire sessioni oltre la data di termine prevista per il finanziamento ${fin.nome} (${dataFmt}).` },
        { status: 400 }
      )
    }
  }

  // ── CHECK 2: Conflitto orario formatore ───────────────────────────────────────
  if (corso.formatore_id && ora_inizio && ora_fine) {
    const { data: altriCorsi } = await admin
      .from('corsi')
      .select('id')
      .eq('formatore_id', corso.formatore_id)
      .neq('id', corso_id)

    if (altriCorsi && altriCorsi.length > 0) {
      const altriCorsiIds = altriCorsi.map((c: { id: string }) => c.id)
      const { data: sessioniSovrapposte } = await admin
        .from('sessioni')
        .select('id, corso_id, ora_inizio, ora_fine')
        .in('corso_id', altriCorsiIds)
        .eq('data', sessioneData)
        .not('ora_inizio', 'is', null)
        .not('ora_fine', 'is', null)

      console.log('[overlap] formatore_id:', corso.formatore_id, '| data:', sessioneData, '| ora_inizio:', ora_inizio, '| ora_fine:', ora_fine)
      console.log('[overlap] altriCorsiIds:', altriCorsiIds, '| sessioniSovrapposte:', sessioniSovrapposte?.length ?? 0)
      for (const s of sessioniSovrapposte || []) {
        const newStart = (ora_inizio as string).substring(0, 5)
        const newEnd = (ora_fine as string).substring(0, 5)
        const exStart = (s.ora_inizio as string).substring(0, 5)
        const exEnd = (s.ora_fine as string).substring(0, 5)
        console.log('[overlap] check:', newStart, newEnd, 'vs', exStart, exEnd, '→ overlap:', newStart < exEnd && newEnd > exStart)
        if (newStart < exEnd && newEnd > exStart) {
          // Fetch corso title for the message
          const { data: altroCorso } = await admin
            .from('corsi')
            .select('title')
            .eq('id', s.corso_id)
            .single()
          const { data: formatoreProfile } = await admin
            .from('profiles')
            .select('nome')
            .eq('id', corso.formatore_id as string)
            .single()
          return NextResponse.json(
            { error: `Il formatore ${formatoreProfile?.nome ?? ''} ha già una sessione in questo slot per il corso "${altroCorso?.title ?? s.corso_id}" (${exStart}–${exEnd}).` },
            { status: 409 }
          )
        }
      }
    }
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
