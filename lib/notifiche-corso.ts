import { createAdminClient } from './supabase/admin'
import { sendEmail, generateCalendarioCompletoEmail, generateCorsoConclusoEmail } from './email'

const PIANIFICAZIONE_EMAIL = 'pianificazione@formascuole.it'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://formascuole.vercel.app'

type AdminClient = ReturnType<typeof createAdminClient>

async function getCorsoDettagli(adminQ: AdminClient, corsoId: string) {
  const { data: corso } = await adminQ
    .from('corsi')
    .select('id, title, project_id, formatore_id, tutor_id, ore_totali')
    .eq('id', corsoId)
    .single()
  if (!corso) return null

  const { data: progetto } = await adminQ
    .from('progetti')
    .select('school_name, finanziamento_id')
    .eq('id', (corso.project_id as string))
    .single()

  let finanziamento: string | null = null
  if (progetto?.finanziamento_id) {
    const { data: fin } = await adminQ
      .from('finanziamenti')
      .select('nome')
      .eq('id', (progetto.finanziamento_id as string))
      .single()
    finanziamento = (fin?.nome as string) ?? null
  }

  const [formatoreRes, tutorRes] = await Promise.all([
    corso.formatore_id
      ? adminQ.from('profiles').select('nome').eq('id', (corso.formatore_id as string)).single()
      : Promise.resolve({ data: null }),
    corso.tutor_id
      ? adminQ.from('profiles').select('nome').eq('id', (corso.tutor_id as string)).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    id: corsoId,
    title: corso.title as string,
    project_id: corso.project_id as string,
    formatore_id: (corso.formatore_id as string) || null,
    ore_totali: Number(corso.ore_totali),
    school_name: (progetto?.school_name as string) ?? '—',
    finanziamento,
    formatore_nome: (formatoreRes.data?.nome as string) ?? '—',
    tutor_nome: (tutorRes.data?.nome as string) ?? null,
  }
}

export async function maybeNotificaCalendarioCompleto(corsoId: string): Promise<void> {
  const adminQ = createAdminClient()

  const { data: corsoOre } = await adminQ
    .from('corsi_con_ore')
    .select('ore_pianificate, ore_totali')
    .eq('id', corsoId)
    .single()

  if (!corsoOre || Number(corsoOre.ore_pianificate) < Number(corsoOre.ore_totali)) return

  const { data: existing } = await adminQ
    .from('solleciti_log')
    .select('id')
    .eq('corso_id', corsoId)
    .eq('tipo', 'notifica_calendario_completo')
    .maybeSingle()
  if (existing) return

  const d = await getCorsoDettagli(adminQ, corsoId)
  if (!d || !d.formatore_id) return

  const corsoUrl = `${APP_URL}/progetti/${d.project_id}/corsi/${d.id}`
  const { subject, body } = generateCalendarioCompletoEmail({
    corso_title: d.title,
    school_name: d.school_name,
    formatore_nome: d.formatore_nome,
    ore_totali: d.ore_totali,
    finanziamento: d.finanziamento,
    corso_url: corsoUrl,
  })

  await Promise.allSettled([
    sendEmail({
      to: PIANIFICAZIONE_EMAIL,
      subject,
      body,
      actions: [{ label: 'Vai al corso', url: corsoUrl, primary: true }],
    }),
    adminQ.from('solleciti_log').insert({
      corso_id: corsoId,
      formatore_id: d.formatore_id,
      tipo: 'notifica_calendario_completo',
    }),
  ])
}

export async function maybeNotificaCorsoConcluso(corsoId: string): Promise<void> {
  const adminQ = createAdminClient()

  const [sessRes, corsoOreRes] = await Promise.all([
    adminQ.from('sessioni').select('ore').eq('corso_id', corsoId).eq('completata', true),
    adminQ.from('corsi_con_ore').select('ore_totali').eq('id', corsoId).single(),
  ])

  const oreErogate = (sessRes.data || []).reduce((s, r) => s + Number(r.ore), 0)
  if (!corsoOreRes.data || oreErogate < Number(corsoOreRes.data.ore_totali)) return

  const { data: existing } = await adminQ
    .from('solleciti_log')
    .select('id')
    .eq('corso_id', corsoId)
    .eq('tipo', 'notifica_corso_concluso')
    .maybeSingle()
  if (existing) return

  const [lastSessRes, d] = await Promise.all([
    adminQ
      .from('sessioni')
      .select('data')
      .eq('corso_id', corsoId)
      .eq('completata', true)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getCorsoDettagli(adminQ, corsoId),
  ])

  if (!d || !d.formatore_id) return

  const corsoUrl = `${APP_URL}/progetti/${d.project_id}/corsi/${d.id}`
  const { subject, body } = await generateCorsoConclusoEmail({
    corso_title: d.title,
    school_name: d.school_name,
    formatore_nome: d.formatore_nome,
    tutor_nome: d.tutor_nome,
    ore_totali: d.ore_totali,
    data_ultima_sessione: (lastSessRes.data?.data as string) ?? '—',
    finanziamento: d.finanziamento,
    corso_url: corsoUrl,
  })

  await Promise.allSettled([
    sendEmail({
      to: PIANIFICAZIONE_EMAIL,
      subject,
      body,
      actions: [{ label: 'Vai al corso', url: corsoUrl, primary: true }],
    }),
    adminQ.from('solleciti_log').insert({
      corso_id: corsoId,
      formatore_id: d.formatore_id,
      tipo: 'notifica_corso_concluso',
    }),
  ])
}
