import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  // Sanitize UUID fields — empty string is invalid for UUID type in PostgreSQL
  if (body.finanziamento_id === '') body.finanziamento_id = null
  if (body.partner_id === '') body.partner_id = null
  // Sanitize numeric field — convert empty string to null, parse to number otherwise
  if (body.quota_progettazione === '' || body.quota_progettazione === undefined) {
    body.quota_progettazione = null
  } else if (body.quota_progettazione !== null) {
    body.quota_progettazione = Number(body.quota_progettazione) || null
  }
  if (body.subappalto_tariffa_formatore === '' || body.subappalto_tariffa_formatore === undefined) {
    body.subappalto_tariffa_formatore = null
  } else if (body.subappalto_tariffa_formatore !== null) {
    body.subappalto_tariffa_formatore = Number(body.subappalto_tariffa_formatore) || null
  }
  if (body.subappalto_tariffa_tutor === '' || body.subappalto_tariffa_tutor === undefined) {
    body.subappalto_tariffa_tutor = null
  } else if (body.subappalto_tariffa_tutor !== null) {
    body.subappalto_tariffa_tutor = Number(body.subappalto_tariffa_tutor) || null
  }

  // Use admin client to bypass RLS for the update
  const adminForUpdate = createAdminClient()
  const { data, error } = await adminForUpdate
    .from('progetti')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Collect corso IDs and check safety blockers
  const { data: corsi } = await admin
    .from('corsi')
    .select('id, lettera_incarico_firmata, corso_completato')
    .eq('project_id', id)
  const corsoIds = (corsi || []).map((c: { id: string }) => c.id)

  const blockers: string[] = []

  if (corsoIds.length > 0) {
    const { data: sessioni } = await admin.from('sessioni').select('id').in('corso_id', corsoIds).eq('completata', true).limit(1)
    if (sessioni?.length) blockers.push('Ci sono sessioni già erogate')

    const { data: notule } = await admin.from('notule').select('id').in('corso_id', corsoIds).eq('stato', 'accettata').limit(1)
    if (notule?.length) blockers.push('Ci sono notule accettate')
  }

  if ((corsi || []).some((c: { lettera_incarico_firmata?: boolean }) => c.lettera_incarico_firmata)) {
    blockers.push("Ci sono lettere d'incarico firmate")
  }
  if ((corsi || []).some((c: { corso_completato?: boolean }) => c.corso_completato)) {
    blockers.push('Ci sono corsi completati')
  }

  if (blockers.length > 0) {
    return NextResponse.json({ error: 'BLOCKERS', blockers }, { status: 422 })
  }

  // Cascade delete
  if (corsoIds.length > 0) {
    await admin.from('note_corso').delete().in('corso_id', corsoIds)
    await admin.from('sessioni').delete().in('corso_id', corsoIds)
    await admin.from('solleciti_log').delete().in('corso_id', corsoIds)
  }
  await admin.from('chat_messaggi').delete().eq('progetto_id', id)
  await admin.from('corsi').delete().eq('project_id', id)
  await admin.from('referenti_progetto').delete().eq('progetto_id', id)

  const { error } = await admin.from('progetti').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
