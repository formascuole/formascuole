import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLetteraIncaricoTutorPdf } from '@/lib/generate-lettera-incarico-pdf'
import { sendLetteraIncaricoEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('role, nome').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(callerProfile?.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, project_id, tutor_id, ore_tutoraggio, tariffa_oraria_tutor')
    .eq('id', id)
    .single()
  if (!corso || !corso.tutor_id)
    return NextResponse.json({ error: 'Corso o tutor non trovato' }, { status: 404 })

  const [{ data: tutor }, { data: progetto }] = await Promise.all([
    admin.from('profiles').select('id, nome, email, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_tutor').eq('id', corso.tutor_id as string).single(),
    admin.from('progetti').select('school_name').eq('id', corso.project_id as string).single(),
  ])
  if (!tutor || !progetto)
    return NextResponse.json({ error: 'Dati tutor o progetto mancanti' }, { status: 404 })

  const tariffaTutor = corso.tariffa_oraria_tutor != null
    ? Number(corso.tariffa_oraria_tutor)
    : (tutor.tariffa_oraria_tutor != null ? Number(tutor.tariffa_oraria_tutor) : null)
  const oreTutoraggio = Number(corso.ore_tutoraggio || 0)
  const compensoStimato = tariffaTutor != null && oreTutoraggio > 0 ? +(oreTutoraggio * tariffaTutor).toFixed(2) : null

  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const pdfBuffer = await generateLetteraIncaricoTutorPdf({
    data: today,
    tutor_nome: tutor.nome as string,
    tutor_indirizzo: tutor.indirizzo_via as string | null,
    tutor_cap: tutor.indirizzo_cap as string | null,
    tutor_citta: tutor.indirizzo_citta as string | null,
    tutor_provincia: tutor.indirizzo_provincia as string | null,
    tutor_codice_fiscale: tutor.codice_fiscale as string | null,
    corso_title: corso.title as string,
    school_name: progetto.school_name as string,
    ore_tutoraggio: oreTutoraggio,
    tariffa_tutor: tariffaTutor,
    compenso_stimato: compensoStimato,
    firma_admin_nome: callerProfile?.nome as string | null,
  })

  const storagePath = `lettere/${id}/lettera_tutor.pdf`
  const { error: uploadError } = await admin.storage.from('notule').upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(storagePath)

  const { data: updated, error: updateError } = await admin
    .from('corsi')
    .update({ lettera_tutor_url: publicUrl, lettera_tutor_firmata: false, lettera_tutor_firmata_at: null, lettera_tutor_ip: null })
    .eq('id', id)
    .select('lettera_tutor_url, lettera_tutor_firmata, lettera_tutor_firmata_at')
    .single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  try {
    const letteraUrl = `${APP_URL}/progetti/${corso.project_id}/corsi/${id}`
    await sendLetteraIncaricoEmail({
      to: tutor.email as string,
      persona_nome: tutor.nome as string,
      corso_title: corso.title as string,
      school_name: progetto.school_name as string,
      pdfBuffer,
      tipo: 'tutor',
      lettera_url: letteraUrl,
    })
  } catch (err) {
    console.error('[lettera-tutor] Email send failed (non-fatal):', err)
  }

  return NextResponse.json(updated)
}
