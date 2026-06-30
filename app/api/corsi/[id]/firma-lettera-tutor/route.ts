import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLetteraIncaricoTutorPdf } from '@/lib/generate-lettera-incarico-pdf'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, project_id, tutor_id, ore_tutoraggio, tariffa_oraria_tutor, lettera_tutor_url, finanziamento_id')
    .eq('id', id)
    .single()
  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(callerProfile?.role)
  if (!isAdmin && corso.tutor_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!corso.lettera_tutor_url)
    return NextResponse.json({ error: 'Lettera non ancora generata' }, { status: 400 })

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '—'

  const firmataAt = new Date().toISOString()

  const [{ data: tutor }, { data: progetto }] = await Promise.all([
    admin.from('profiles').select('nome, email, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_tutor').eq('id', corso.tutor_id as string).single(),
    admin.from('progetti').select('school_name, finanziamento_id').eq('id', corso.project_id as string).single(),
  ])

  if (tutor && progetto) {
    const tariffaTutor = corso.tariffa_oraria_tutor != null
      ? Number(corso.tariffa_oraria_tutor)
      : (tutor.tariffa_oraria_tutor != null ? Number(tutor.tariffa_oraria_tutor) : null)
    const oreTutoraggio = Number(corso.ore_tutoraggio || 0)
    const compensoStimato = tariffaTutor != null && oreTutoraggio > 0 ? +(oreTutoraggio * tariffaTutor).toFixed(2) : null
    const dataFormatted = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const finId = (corso.finanziamento_id || progetto.finanziamento_id) as string | null
    let finanziamento_nome: string | null = null
    if (finId) {
      const { data: fin } = await admin.from('finanziamenti').select('nome').eq('id', finId).single()
      finanziamento_nome = (fin?.nome as string | null) ?? null
    }

    const pdfBuffer = await generateLetteraIncaricoTutorPdf({
      data: dataFormatted,
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
      finanziamento_nome,
      firmata: true,
      firmata_at: firmataAt,
      firmata_ip: ip,
      firmata_user_id: user.id,
    })

    const storagePath = `lettere/${id}/lettera_tutor.pdf`
    await admin.storage.from('notule').upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  }

  const { data: updated, error } = await admin
    .from('corsi')
    .update({
      lettera_tutor_firmata: true,
      lettera_tutor_firmata_at: firmataAt,
      lettera_tutor_ip: ip,
    })
    .eq('id', id)
    .select('lettera_tutor_url, lettera_tutor_firmata, lettera_tutor_firmata_at, lettera_tutor_ip')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
