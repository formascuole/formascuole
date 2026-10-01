import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRispostaFormatoreEmail, sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ruolo = new URL(req.url).searchParams.get('ruolo') // 'co_formatore' oppure null

  const { motivazione } = await req.json()
  if (!motivazione?.trim()) {
    return NextResponse.json({ error: 'La motivazione è obbligatoria' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, formatore_id, co_formatore_id, project_id, stato_assegnazione, stato_assegnazione_co_formatore')
    .eq('id', corsoId)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  const isCoFormatore = ruolo === 'co_formatore' && corso.co_formatore_id === user.id
  const isFormatore = corso.formatore_id === user.id

  if (!isFormatore && !isCoFormatore) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: formatore } = await admin
    .from('profiles')
    .select('nome, email')
    .eq('id', user.id)
    .single()

  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name')
    .eq('id', corso.project_id)
    .single()

  // ── Caso co-formatore: rimuove solo il co-formatore, non tocca il formatore principale ──
  if (isCoFormatore) {
    if (corso.stato_assegnazione_co_formatore !== 'in_attesa') {
      return NextResponse.json({ error: 'Il co-incarico non è in attesa di accettazione' }, { status: 400 })
    }

    const { error: coErr } = await admin
      .from('corsi')
      .update({
        co_formatore_id: null,
        ore_co_formatore: null,
        tariffa_oraria_co_formatore: null,
        stato_assegnazione_co_formatore: 'non_assegnato',
        ore_formatore: null, // ripristina ore_formatore al totale (gestito lato admin al prossimo salvataggio)
      })
      .eq('id', corsoId)

    if (coErr) return NextResponse.json({ error: coErr.message }, { status: 500 })

    // Notifica admin
    if (progetto && formatore) {
      const { data: admins } = await admin.from('profiles').select('email').in('role', ['admin', 'super_admin'])
      const emailBody = await generateRispostaFormatoreEmail({
        formatore_nome: formatore.nome,
        corso_title: corso.title,
        school_name: progetto.school_name,
        risposta: 'rifiutato',
        motivazione: `[Co-formatore] ${motivazione.trim()}`,
        corso_admin_url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corsoId}`,
      })
      for (const a of admins || []) {
        sendEmail({
          to: a.email,
          subject: `Formascuole — ${formatore.nome} ha rifiutato (co-formatore): ${corso.title} — ${progetto.school_name}`,
          body: emailBody,
          actions: [{ label: 'Gestisci il corso', url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corsoId}`, primary: true }],
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, ruolo: 'co_formatore' })
  }

  // ── Caso formatore principale ────────────────────────────────────────────────
  if (corso.stato_assegnazione !== 'in_attesa') {
    return NextResponse.json({ error: 'Il corso non è in attesa di accettazione' }, { status: 400 })
  }

  // Reset course — remove formatore, mark as rifiutato
  const { error } = await admin
    .from('corsi')
    .update({
      stato_assegnazione: 'rifiutato',
      formatore_id: null,
      rifiuto_motivazione: motivazione.trim(),
      accettazione_risposta_at: new Date().toISOString(),
    })
    .eq('id', corsoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (progetto && formatore) {
    const { data: admins } = await admin
      .from('profiles')
      .select('email')
      .in('role', ['admin', 'super_admin'])

    const emailBody = await generateRispostaFormatoreEmail({
      formatore_nome: formatore.nome,
      corso_title: corso.title,
      school_name: progetto.school_name,
      risposta: 'rifiutato',
      motivazione: motivazione.trim(),
      corso_admin_url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corsoId}`,
    })

    for (const a of admins || []) {
      sendEmail({
        to: a.email,
        subject: `Formascuole — ${formatore.nome} ha rifiutato: ${corso.title} — ${progetto.school_name}`,
        body: emailBody,
        actions: [{ label: 'Riassegna il corso', url: `${APP_URL}/progetti/${corso.project_id}/corsi/${corsoId}`, primary: true }],
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true })
}
