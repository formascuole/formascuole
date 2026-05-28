import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { TutorClient } from './TutorClient'

export default async function TutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (profile.role !== 'tutor') redirect('/formatore')

  // Usa il service role client per bypassare RLS sulla view corsi_con_ore
  const admin = createAdminClient()

  // Corsi del tutor — select diretto senza join sulla view
  const { data: corsi } = await admin
    .from('corsi_con_ore')
    .select('*')
    .eq('tutor_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch dati progetto e formatore separatamente
  const projectIds = [...new Set((corsi || []).map(c => c.project_id))]
  type ProgettoRow = {
    id: string; school_name: string; address: string | null
    anno_scolastico: string | null
    ref_name: string; ref_email: string; ref_tel: string | null
    finanziamento_id: string | null
  }
  let progettiRows: ProgettoRow[] = []
  if (projectIds.length > 0) {
    const { data } = await admin
      .from('progetti')
      .select('id, school_name, address, anno_scolastico, ref_name, ref_email, ref_tel, finanziamento_id')
      .in('id', projectIds)
    progettiRows = (data || []) as ProgettoRow[]
  }
  const progettiMap = new Map(progettiRows.map(p => [p.id, p]))

  // Fetch formatori dei corsi
  const formatoreIds = [...new Set((corsi || []).filter(c => c.formatore_id).map(c => c.formatore_id as string))]
  type FormatoreRow = { id: string; nome: string; email: string; avatar_initials: string }
  let formatoriRows: FormatoreRow[] = []
  if (formatoreIds.length > 0) {
    const { data } = await admin
      .from('profiles')
      .select('id, nome, email, avatar_initials')
      .in('id', formatoreIds)
    formatoriRows = (data || []) as FormatoreRow[]
  }
  const formatoriMap = new Map(formatoriRows.map(f => [f.id, f]))

  // Batch-fetch referenti specifici dei corsi
  const referenteIds = [...new Set(
    (corsi || []).filter(c => c.referente_id).map(c => c.referente_id as string)
  )]
  const referentiMap = new Map<string, { id: string; nome: string; email: string; tel?: string }>()
  if (referenteIds.length > 0) {
    const { data: referenti } = await admin
      .from('referenti_progetto')
      .select('id,nome,email,tel')
      .in('id', referenteIds)
    for (const r of referenti || []) referentiMap.set(r.id, r)
  }

  const corsiConReferente = (corsi || []).map(c => ({
    ...c,
    progetti: progettiMap.get(c.project_id) || null,
    formatore: c.formatore_id ? formatoriMap.get(c.formatore_id) || null : null,
    referente: c.referente_id ? referentiMap.get(c.referente_id) || null : null,
  }))

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('id,nome')
    .order('nome')

  // Ore erogate per i corsi del tutor
  const corsiIds = (corsi || []).map(c => c.id)
  const oreErogatePerCorso = new Map<string, number>()
  let oreTutorErogate = 0
  if (corsiIds.length > 0) {
    const { data: sessioni } = await admin
      .from('sessioni')
      .select('corso_id, ore')
      .in('corso_id', corsiIds)
      .eq('completata', true)
    for (const s of sessioni || []) {
      oreErogatePerCorso.set(s.corso_id, (oreErogatePerCorso.get(s.corso_id) ?? 0) + Number(s.ore))
      oreTutorErogate += Number(s.ore)
    }
  }

  return (
    <AppLayout
      role="tutor"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
    >
      <TutorClient
        corsi={corsiConReferente}
        profile={profile}
        finanziamenti={finanziamenti || []}
        oreErogate={oreTutorErogate}
        oreErogatePerCorso={Object.fromEntries(oreErogatePerCorso)}
      />
    </AppLayout>
  )
}
