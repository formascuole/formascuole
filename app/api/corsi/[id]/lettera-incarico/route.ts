import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLetteraIncaricoFormatorePdf } from '@/lib/generate-lettera-incarico-pdf'
import { sendLetteraAggiornataEmail } from '@/lib/email'

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
    .select('id, title, project_id, formatore_id, ore_totali, tipo, modalita, location, tariffa_oraria, lettera_incarico_url, finanziamento_id')
    .eq('id', id)
    .single()
  if (!corso || !corso.formatore_id)
    return NextResponse.json({ error: 'Corso o formatore non trovato' }, { status: 404 })

  const isRigenera = !!corso.lettera_incarico_url

  const [{ data: formatore }, { data: progetto }] = await Promise.all([
    admin.from('profiles').select('id, nome, email, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_formatore').eq('id', corso.formatore_id as string).single(),
    admin.from('progetti').select('school_name, finanziamento_id').eq('id', corso.project_id as string).single(),
  ])
  if (!formatore || !progetto)
    return NextResponse.json({ error: 'Dati formatore o progetto mancanti' }, { status: 404 })

  const finId = (corso.finanziamento_id || progetto.finanziamento_id) as string | null
  let finanziamento_nome: string | null = null
  if (finId) {
    const { data: fin } = await admin.from('finanziamenti').select('nome').eq('id', finId).single()
    finanziamento_nome = (fin?.nome as string | null) ?? null
  }

  const tariffa = corso.tariffa_oraria != null
    ? Number(corso.tariffa_oraria)
    : (formatore.tariffa_oraria_formatore != null ? Number(formatore.tariffa_oraria_formatore) : null)
  const oreTotali = Number(corso.ore_totali)
  const compensoStimato = tariffa != null ? +(oreTotali * tariffa).toFixed(2) : null

  const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const pdfBuffer = await generateLetteraIncaricoFormatorePdf({
    data: today,
    formatore_nome: formatore.nome as string,
    formatore_indirizzo: formatore.indirizzo_via as string | null,
    formatore_cap: formatore.indirizzo_cap as string | null,
    formatore_citta: formatore.indirizzo_citta as string | null,
    formatore_provincia: formatore.indirizzo_provincia as string | null,
    formatore_codice_fiscale: formatore.codice_fiscale as string | null,
    corso_title: corso.title as string,
    corso_tipo: corso.tipo as string,
    modalita: corso.modalita as string | null,
    location: corso.location as string | null,
    school_name: progetto.school_name as string,
    ore_totali: oreTotali,
    tariffa,
    compenso_stimato: compensoStimato,
    finanziamento_nome,
    firma_admin_nome: callerProfile?.nome as string | null,
  })

  const storagePath = `lettere/${id}/lettera_formatore.pdf`
  const { error: uploadError } = await admin.storage.from('notule').upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(storagePath)

  const { data: updated, error: updateError } = await admin
    .from('corsi')
    .update({
      lettera_incarico_url: publicUrl,
      lettera_incarico_firmata: false,
      lettera_incarico_firmata_at: null,
      lettera_incarico_ip: null,
      lettera_incarico_pending: true,
      lettera_incarico_inviata_at: null,
      lettera_incarico_sollecito_at: null,
    })
    .eq('id', id)
    .select('lettera_incarico_url, lettera_incarico_firmata, lettera_incarico_firmata_at, lettera_incarico_pending')
    .single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (isRigenera) {
    try {
      const letteraUrl = `${APP_URL}/progetti/${corso.project_id}/corsi/${id}#lettera-incarico`
      await sendLetteraAggiornataEmail({
        to: formatore.email as string,
        persona_nome: formatore.nome as string,
        corso_title: corso.title as string,
        school_name: progetto.school_name as string,
        tipo: 'formatore',
        lettera_url: letteraUrl,
      })
    } catch (err) {
      console.error('[lettera-incarico] Rigenera notification failed (non-fatal):', err)
    }
  }

  return NextResponse.json(updated)
}
