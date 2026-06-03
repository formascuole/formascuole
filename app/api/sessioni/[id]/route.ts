import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateModificaSessioneEmail, sendEmail } from '@/lib/email'
import { maybeNotificaCalendarioCompleto, maybeNotificaCorsoConcluso } from '@/lib/notifiche-corso'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessione } = await supabase.from('sessioni').select('corso_id').eq('id', id).single()
  if (!sessione) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) {
    const { data: corso } = await supabase.from('corsi').select('formatore_id').eq('id', sessione.corso_id).single()
    if (corso?.formatore_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase.from('sessioni').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessione } = await supabase
    .from('sessioni')
    .select('corso_id, completata')
    .eq('id', id)
    .single()
  if (!sessione) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Permission: admin or the formatore of the corso
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) {
    const { data: corso } = await supabase.from('corsi').select('formatore_id').eq('id', sessione.corso_id).single()
    if (corso?.formatore_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json()

  // Only allow marking as completata (not unmarking)
  if (body.completata !== true) {
    return NextResponse.json({ error: 'Can only mark as completata' }, { status: 400 })
  }

  if (sessione.completata) {
    return NextResponse.json({ error: 'Already completata' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sessioni')
    .update({ completata: true, completata_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notifica corso concluso
  maybeNotificaCorsoConcluso(sessione.corso_id).catch(err =>
    console.error('[notifica] Errore corso concluso:', err)
  )

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessione } = await supabase
    .from('sessioni')
    .select('corso_id, data, ore, completata')
    .eq('id', id)
    .single()
  if (!sessione) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (sessione.completata) return NextResponse.json({ error: 'Impossibile modificare una sessione completata' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role, nome').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(profile?.role)
  if (!isAdmin) {
    const { data: corso } = await supabase.from('corsi').select('formatore_id').eq('id', sessione.corso_id).single()
    if (corso?.formatore_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { data: newData, ore: newOreBody, ora_inizio: newOraInizio, ora_fine: newOraFine, motivazione_categoria, motivazione_dettaglio, modalita_sessione } = body

  // Derive ore from times if provided
  let newOre = newOreBody
  if (!newOre && newOraInizio && newOraFine) {
    const [sh, sm] = (newOraInizio as string).split(':').map(Number)
    const [eh, em] = (newOraFine as string).split(':').map(Number)
    const diffMin = (eh * 60 + em) - (sh * 60 + sm)
    if (diffMin > 0) newOre = Math.round((diffMin / 60) * 2) / 2
  }

  if (!motivazione_categoria) return NextResponse.json({ error: 'Motivazione categoria obbligatoria' }, { status: 400 })
  if (motivazione_categoria === 'altro' && !motivazione_dettaglio?.trim()) {
    return NextResponse.json({ error: 'Motivazione dettaglio obbligatoria per la categoria "Altro"' }, { status: 400 })
  }

  const dateChanged = newData && newData !== sessione.data
  const oreChanged = newOre !== undefined && Number(newOre) !== Number(sessione.ore)
  const oraInizioChanged = newOraInizio !== undefined
  const oraFineChanged = newOraFine !== undefined

  if (!dateChanged && !oreChanged && !modalita_sessione && !oraInizioChanged && !oraFineChanged) {
    return NextResponse.json({ error: 'Nessuna modifica da salvare' }, { status: 400 })
  }

  if (oreChanged) {
    const { data: corsoOre } = await supabase.from('corsi_con_ore').select('ore_residue').eq('id', sessione.corso_id).single()
    const maxOre = (Number(corsoOre?.ore_residue) || 0) + Number(sessione.ore)
    if (Number(newOre) < 1) return NextResponse.json({ error: 'Le ore devono essere almeno 1' }, { status: 400 })
    if (Number(newOre) > maxOre) return NextResponse.json({ error: `Le ore (${newOre}) superano il massimo disponibile (${maxOre}h)` }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (dateChanged) updates.data = newData
  if (oreChanged) updates.ore = Number(newOre)
  if (modalita_sessione) updates.modalita_sessione = modalita_sessione
  if (oraInizioChanged) updates.ora_inizio = newOraInizio || null
  if (oraFineChanged) updates.ora_fine = newOraFine || null

  const { data: updated, error: updateError } = await supabase
    .from('sessioni').update(updates).eq('id', id).select().single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const adminQ = createAdminClient()

  // Insert log row(s)
  const logRows: Record<string, unknown>[] = []
  const logBase = {
    sessione_id: id,
    corso_id: sessione.corso_id,
    utente_id: user.id,
    motivazione_categoria,
    motivazione_dettaglio: motivazione_dettaglio?.trim() || null,
  }
  if (dateChanged) logRows.push({ ...logBase, tipo_modifica: 'modifica_data', data_precedente: sessione.data, data_nuova: newData })
  if (oreChanged) logRows.push({ ...logBase, tipo_modifica: 'modifica_ore', ore_precedenti: Number(sessione.ore), ore_nuove: Number(newOre) })
  if (logRows.length > 0) await adminQ.from('sessioni_log').insert(logRows)

  // Notify all admins when modified by formatore
  if (!isAdmin) {
    const [{ data: corsoInfo }, { data: admins }] = await Promise.all([
      adminQ.from('corsi').select('title, project_id').eq('id', sessione.corso_id).single(),
      adminQ.from('profiles').select('email').in('role', ['admin', 'super_admin']),
    ])
    const { data: progettoInfo } = corsoInfo
      ? await adminQ.from('progetti').select('school_name').eq('id', corsoInfo.project_id).single()
      : { data: null }

    if (corsoInfo && progettoInfo && profile) {
      const corsoUrl = `${process.env.NEXT_PUBLIC_APP_URL}/progetti/${corsoInfo.project_id}/corsi/${sessione.corso_id}`
      const { subject, body: emailBody } = await generateModificaSessioneEmail({
        formatore_nome: profile.nome,
        corso_title: corsoInfo.title,
        school_name: progettoInfo.school_name,
        data_precedente: dateChanged ? (sessione.data as string) : undefined,
        data_nuova: dateChanged ? newData : undefined,
        ore_precedenti: oreChanged ? Number(sessione.ore) : undefined,
        ore_nuove: oreChanged ? Number(newOre) : undefined,
        motivazione_categoria,
        motivazione_dettaglio: motivazione_dettaglio?.trim() || undefined,
        corso_admin_url: corsoUrl,
      })
      await Promise.allSettled(
        (admins || []).map(a => sendEmail({ to: a.email, subject, body: emailBody, actions: [{ label: 'Vedi corso', url: corsoUrl, primary: true }] }))
      )
    }
  }

  // Notifica calendario completo (solo se le ore sono cambiate)
  if (oreChanged) {
    maybeNotificaCalendarioCompleto(sessione.corso_id).catch(err =>
      console.error('[notifica] Errore calendario completo (PUT sessione):', err)
    )
  }

  return NextResponse.json(updated)
}
