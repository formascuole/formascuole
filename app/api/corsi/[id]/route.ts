import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTokenMateriali } from '@/lib/token-materiali'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('title' in body && body.title?.trim()) updates.title = body.title.trim()
  if ('tipo' in body) updates.tipo = body.tipo
  if ('modalita' in body) updates.modalita = body.modalita || null
  if ('ore_totali' in body) { const n = Number(body.ore_totali); if (n > 0) updates.ore_totali = n }
  if ('ore_presenza' in body) updates.ore_presenza = body.ore_presenza != null && body.ore_presenza !== '' ? Number(body.ore_presenza) : null
  if ('ore_online' in body) updates.ore_online = body.ore_online != null && body.ore_online !== '' ? Number(body.ore_online) : null
  if ('location' in body) updates.location = body.location?.trim() || null
  if ('link_scheda' in body) updates.link_scheda = body.link_scheda?.trim() || null
  if ('descrizione' in body) updates.descrizione = body.descrizione?.trim() || null
  if ('tariffa_oraria' in body) {
    const t = body.tariffa_oraria
    updates.tariffa_oraria = t !== null && t !== '' ? Number(t) : null
  }
  if ('tariffa_oraria_tutor' in body) {
    const t = body.tariffa_oraria_tutor
    updates.tariffa_oraria_tutor = t !== null && t !== '' ? Number(t) : null
  }
  if ('edizione' in body) updates.edizione = body.edizione?.trim() || null
  if ('note' in body) updates.note = body.note?.trim() || null
  if ('pre_assegnazione' in body) updates.pre_assegnazione = !!body.pre_assegnazione

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('corsi').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-generate portal token when calendar becomes complete
  if (!data.token_materiali) {
    const { data: view } = await admin
      .from('corsi_con_ore')
      .select('calendario_completo, title, project_id')
      .eq('id', id)
      .single()
    if (view?.calendario_completo) {
      const { data: progetto } = await admin
        .from('progetti')
        .select('school_name')
        .eq('id', view.project_id)
        .single()
      const { data: sessioni } = await admin
        .from('sessioni')
        .select('data')
        .eq('corso_id', id)
        .order('data', { ascending: false })
        .limit(1)
      let materiali_scadenza: string | null = null
      if (sessioni && sessioni.length > 0) {
        const d = new Date(sessioni[0].data + 'T00:00:00')
        d.setDate(d.getDate() + 30)
        materiali_scadenza = d.toISOString().slice(0, 10)
      }
      const token = generateTokenMateriali(view.title, progetto?.school_name ?? '')
      await admin.from('corsi').update({ token_materiali: token, ...(materiali_scadenza ? { materiali_scadenza } : {}) }).eq('id', id)
      data.token_materiali = token
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Accesso riservato agli amministratori' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Cascade delete
  await admin.from('note_corso').delete().eq('corso_id', id)
  await admin.from('sessioni').delete().eq('corso_id', id)
  await admin.from('solleciti_log').delete().eq('corso_id', id)

  const { error } = await admin.from('corsi').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
