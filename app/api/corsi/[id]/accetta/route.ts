import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRispostaFormatoreEmail, sendEmail } from '@/lib/email'
import { generateLetteraIncaricoFormatorePdf } from '@/lib/generate-lettera-incarico-pdf'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, formatore_id, project_id, stato_assegnazione, ore_totali, tipo, tariffa_oraria')
    .eq('id', corsoId)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })
  if (corso.formatore_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (corso.stato_assegnazione !== 'in_attesa') {
    return NextResponse.json({ error: 'Il corso non è in attesa di accettazione' }, { status: 400 })
  }

  const { error } = await admin
    .from('corsi')
    .update({
      stato_assegnazione: 'accettato',
      accettazione_risposta_at: new Date().toISOString(),
    })
    .eq('id', corsoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [{ data: progetto }, { data: formatore }] = await Promise.all([
    admin.from('progetti').select('school_name, status').eq('id', corso.project_id).single(),
    admin.from('profiles').select('nome, email, indirizzo_via, indirizzo_cap, indirizzo_citta, indirizzo_provincia, codice_fiscale, tariffa_oraria_formatore').eq('id', user.id).single(),
  ])

  // Auto-generate lettera incarico only for active projects
  if (formatore && progetto && progetto.status === 'active') {
    try {
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
        school_name: progetto.school_name as string,
        ore_totali: oreTotali,
        tariffa,
        compenso_stimato: compensoStimato,
        firma_admin_nome: null,
      })

      const storagePath = `lettere/${corsoId}/lettera_formatore.pdf`
      await admin.storage.from('notule').upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
      const { data: { publicUrl } } = admin.storage.from('notule').getPublicUrl(storagePath)

      await admin.from('corsi').update({
        lettera_incarico_url: publicUrl,
        lettera_incarico_pending: true,
        lettera_incarico_firmata: false,
        lettera_incarico_firmata_at: null,
        lettera_incarico_ip: null,
        lettera_incarico_inviata_at: null,
        lettera_incarico_sollecito_at: null,
      }).eq('id', corsoId)
    } catch (err) {
      console.error('[accetta] Lettera generation failed (non-fatal):', err)
    }
  }

  // Notify admins (fire and forget)
  if (progetto && formatore) {
    const { data: admins } = await admin
      .from('profiles')
      .select('email')
      .in('role', ['admin', 'super_admin'])

    const emailBody = await generateRispostaFormatoreEmail({
      formatore_nome: formatore.nome as string,
      corso_title: corso.title as string,
      school_name: progetto.school_name as string,
      risposta: 'accettato',
      corso_admin_url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corsoId}`,
    })

    for (const a of admins || []) {
      sendEmail({
        to: a.email,
        subject: `Formascuole — ${formatore.nome} ha accettato: ${corso.title} — ${progetto.school_name}`,
        body: emailBody,
        actions: [{ label: 'Vedi scheda corso', url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corsoId}`, primary: true }],
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true })
}
