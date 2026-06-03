import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, generateCompletamentoFormatoreEmail } from '@/lib/email'

const PIANIFICAZIONE_EMAIL = 'pianificazione@formascuole.it'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch course with project and finanziamento
  const { data: corso } = await admin
    .from('corsi')
    .select('id, title, project_id, formatore_id, tutor_id, ore_totali, ore_tutoraggio, tariffa_oraria, tariffa_oraria_tutor, corso_completato')
    .eq('id', id)
    .single()

  if (!corso) return NextResponse.json({ error: 'Corso non trovato' }, { status: 404 })

  // Only the assigned formatore can mark as complete
  if (corso.formatore_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (corso.corso_completato) {
    return NextResponse.json({ error: 'Corso già segnato come completato' }, { status: 409 })
  }

  // Validate: ore erogate must equal ore totali
  const { data: sessioni } = await admin
    .from('sessioni')
    .select('ore, data, completata')
    .eq('corso_id', id)

  const oreErogate = (sessioni || [])
    .filter(s => s.completata)
    .reduce((sum, s) => sum + Number(s.ore), 0)

  if (oreErogate < Number(corso.ore_totali)) {
    return NextResponse.json(
      { error: 'Il corso non risulta completato al 100% (ore erogate insufficienti)' },
      { status: 400 }
    )
  }

  // Fetch project, finanziamento, formatore profile
  const { data: progetto } = await admin
    .from('progetti')
    .select('school_name, finanziamento_id')
    .eq('id', corso.project_id as string)
    .single()

  let finanziamento: string | null = null
  if (progetto?.finanziamento_id) {
    const { data: fin } = await admin
      .from('finanziamenti')
      .select('nome')
      .eq('id', progetto.finanziamento_id as string)
      .single()
    finanziamento = (fin?.nome as string) ?? null
  }

  const { data: formatoreProfile } = await admin
    .from('profiles')
    .select('nome, email')
    .eq('id', user.id)
    .single()

  if (!formatoreProfile) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })

  // Fetch tutor profile if present
  let tutorNome: string | null = null
  if (corso.tutor_id) {
    const { data: tutorProfile } = await admin
      .from('profiles')
      .select('nome')
      .eq('id', corso.tutor_id as string)
      .single()
    tutorNome = (tutorProfile?.nome as string) ?? null
  }

  // Compute ore tutoraggio erogate (proportional to formazione erogate)
  const oreTutoraggio = Number(corso.ore_tutoraggio || 0)
  const oreTotaliNum = Number(corso.ore_totali)
  const oreTutorErogate = oreTotaliNum > 0 && oreTutoraggio > 0
    ? Math.round(oreTutoraggio * (oreErogate / oreTotaliNum))
    : 0

  // Compute first and last session dates
  const completedSessions = (sessioni || [])
    .filter(s => s.completata)
    .map(s => s.data as string)
    .sort()

  const formatSessionDate = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const dataPrima = completedSessions.length > 0 ? formatSessionDate(completedSessions[0]) : '—'
  const dataUltima = completedSessions.length > 0 ? formatSessionDate(completedSessions[completedSessions.length - 1]) : '—'

  // Mark course as complete
  const { error: updateErr } = await admin
    .from('corsi')
    .update({ corso_completato: true, corso_completato_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Build emails
  const emailParams = {
    formatore_nome: formatoreProfile.nome as string,
    formatore_email: formatoreProfile.email as string,
    corso_title: corso.title as string,
    school_name: (progetto?.school_name as string) ?? '—',
    data_prima_sessione: dataPrima,
    data_ultima_sessione: dataUltima,
    ore_erogate: oreErogate,
    tariffa_oraria: corso.tariffa_oraria ? Number(corso.tariffa_oraria) : null,
    finanziamento,
    tutor_nome: tutorNome,
    ore_tutoraggio_erogate: oreTutorErogate > 0 ? oreTutorErogate : null,
    tariffa_oraria_tutor: corso.tariffa_oraria_tutor ? Number(corso.tariffa_oraria_tutor) : null,
  }

  const { subject: subjFormatore, body: bodyFormatore } = await generateCompletamentoFormatoreEmail(emailParams)

  const corsoUrl = `${APP_URL}/progetti/${corso.project_id}/corsi/${id}`
  const bodyPianificazione = `Il formatore ${formatoreProfile.nome} ha dichiarato completato il corso "${corso.title}" presso ${progetto?.school_name ?? '—'}.

Periodo: ${dataPrima} — ${dataUltima}
Ore erogate: ${oreErogate}h${finanziamento ? `\nLinea finanziamento: ${finanziamento}` : ''}

Scheda corso: ${corsoUrl}`

  await Promise.allSettled([
    // Email to formatore
    sendEmail({
      to: formatoreProfile.email as string,
      subject: subjFormatore,
      body: bodyFormatore,
    }),
    // Email to pianificazione team
    sendEmail({
      to: PIANIFICAZIONE_EMAIL,
      subject: `Corso completato — ${corso.title} — ${progetto?.school_name ?? '—'}`,
      body: bodyPianificazione,
      actions: [{ label: 'Vai al corso', url: corsoUrl, primary: true }],
    }),
    // Insert solleciti_log to prevent cron duplicate of notifica_corso_concluso
    admin.from('solleciti_log').insert({
      corso_id: id,
      formatore_id: user.id,
      tipo: 'notifica_corso_concluso',
    }),
  ])

  return NextResponse.json({ success: true })
}
