import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin','super_admin'].includes(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { school_name, address, anno_scolastico, finanziamento_id, partner_id, quota_progettazione, quota_progettazione_note, ref_name, ref_email, ref_tel, ref_ruolo, status, regione, provincia, citta, is_subappalto, subappalto_tariffa_formatore, subappalto_tariffa_tutor } = body

  if (!school_name || !ref_name || !ref_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('progetti')
    .insert({
      school_name,
      address: address || '',
      ...(anno_scolastico && { anno_scolastico }),
      finanziamento_id: finanziamento_id || null,
      partner_id: partner_id || null,
      is_subappalto: !!is_subappalto,
      subappalto_tariffa_formatore: subappalto_tariffa_formatore != null && subappalto_tariffa_formatore !== '' ? Number(subappalto_tariffa_formatore) : null,
      subappalto_tariffa_tutor: subappalto_tariffa_tutor != null && subappalto_tariffa_tutor !== '' ? Number(subappalto_tariffa_tutor) : null,
      quota_progettazione: quota_progettazione != null && quota_progettazione !== '' ? Number(quota_progettazione) : null,
      quota_progettazione_note: quota_progettazione_note || null,
      ref_name,
      ref_email,
      ref_tel,
      ref_ruolo: ref_ruolo || null,
      status: status || 'active',
      created_by: user.id,
      regione: regione || null,
      provincia: provincia || null,
      citta: citta || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
