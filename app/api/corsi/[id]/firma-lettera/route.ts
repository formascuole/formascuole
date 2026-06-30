import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLetteraIncaricoFormatorePdf } from '@/lib/generate-lettera-incarico-pdf'

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
    .select('id, title, project_id, formatore_id, ore_totali, tipo, tariffa_oraria, lettera_incarico_url, finanziamento_id')
    .eq('id', id)
    .single()
  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  // Only the assigned formatore or an admin can sign
  const { data: callerProfile } = await supabase.from('profiles').select('role, nome').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin'].includes(callerProfile?.role)
  if (!isAdmin && corso.formatore_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!corso.lettera_incarico_url)
    return NextResponse.json({ error: 'Lettera non ancora generata' }, { status: 400 })

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '—'

  const firmataAt = new Date().toISOString()

  const [{ data: formatore }, { data: progetto }] = await Promise.all([
    admin.from('profiles').select('nome, email, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_formatore').eq('id', corso.formatore_id as string).single(),
    admin.from('progetti').select('school_name, finanziamento_id').eq('id', corso.project_id as string).single(),
  ])

  if (formatore && progetto) {
    const tariffa = corso.tariffa_oraria != null
      ? Number(corso.tariffa_oraria)
      : (formatore.tariffa_oraria_formatore != null ? Number(formatore.tariffa_oraria_formatore) : null)
    const oreTotali = Number(corso.ore_totali)
    const compensoStimato = tariffa != null ? +(oreTotali * tariffa).toFixed(2) : null
    const dataFormatted = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const finId = (corso.finanziamento_id || progetto.finanziamento_id) as string | null
    let finanziamento_nome: string | null = null
    if (finId) {
      const { data: fin } = await admin.from('finanziamenti').select('nome').eq('id', finId).single()
      finanziamento_nome = (fin?.nome as string | null) ?? null
    }

    const pdfBuffer = await generateLetteraIncaricoFormatorePdf({
      data: dataFormatted,
      formatore_nome: formatore.nome as string,
      formatore_indirizzo: formatore.indirizzo_via as string | null,
      formatore_cap: formatore.indirizzo_cap as string | null,
      formatore_citta: formatore.indirizzo_citta as string | null,
      formatore_provincia: formatore.indirizzo_provincia as string | null,
      formatore_codice_fiscale: formatore.codice_fiscale as string | null,
      corso_title: corso.title as string,
      corso_tipo: corso.tipo as string,
      school_name: progetto.school_name as string,
      ore_totali: oreTotali,
      tariffa,
      compenso_stimato: compensoStimato,
      finanziamento_nome,
      firmata: true,
      firmata_at: firmataAt,
      firmata_ip: ip,
      firmata_user_id: user.id,
    })

    const storagePath = `lettere/${id}/lettera_formatore.pdf`
    await admin.storage.from('notule').upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  }

  const { data: updated, error } = await admin
    .from('corsi')
    .update({
      lettera_incarico_firmata: true,
      lettera_incarico_firmata_at: firmataAt,
      lettera_incarico_ip: ip,
    })
    .eq('id', id)
    .select('lettera_incarico_url, lettera_incarico_firmata, lettera_incarico_firmata_at, lettera_incarico_ip')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
