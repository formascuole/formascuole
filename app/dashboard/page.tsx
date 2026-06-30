import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgettoConStats } from '@/lib/types'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { DashboardClient, type DashCorso } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin','super_admin'].includes(profile.role)) redirect('/formatore')

  const admin = createAdminClient()

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)

  const [
    { data: progettiRaw },
    { data: corsiRaw },
    { data: sessioniRaw },
    { data: finanziamentiRaw },
    notifiche,
  ] = await Promise.all([
    admin.from('progetti_con_stats').select('*').order('created_at', { ascending: false }),
    admin.from('corsi').select('id, project_id, formatore_id, tutor_previsto, ore_tutoraggio, ore_totali, calendario_inviato_at, calendario_confermato, stato_assegnazione, accettazione_risposta_at, finanziamento_id'),
    admin.from('sessioni').select('corso_id, ore, completata'),
    admin.from('finanziamenti').select('id, nome').eq('attivo', true).order('nome'),
    getUnreadNotificheCount(supabase, user.id),
  ])

  const progetti = (progettiRaw || []) as ProgettoConStats[]

  const oreCompletatePerCorso: Record<string, number> = {}
  const orePianificatePerCorso: Record<string, number> = {}
  for (const s of sessioniRaw || []) {
    const id = s.corso_id as string
    const ore = Number(s.ore)
    orePianificatePerCorso[id] = (orePianificatePerCorso[id] ?? 0) + ore
    if (s.completata) {
      oreCompletatePerCorso[id] = (oreCompletatePerCorso[id] ?? 0) + ore
    }
  }

  const oreErogatePerProgetto: Record<string, number> = {}
  for (const c of corsiRaw || []) {
    const ore = oreCompletatePerCorso[c.id as string] ?? 0
    if (ore > 0) oreErogatePerProgetto[c.project_id as string] = (oreErogatePerProgetto[c.project_id as string] ?? 0) + ore
  }

  const corsi: DashCorso[] = (corsiRaw || []).map(c => ({
    id: c.id as string,
    project_id: c.project_id as string,
    finanziamento_id: (c.finanziamento_id as string | null) ?? null,
    formatore_id: (c.formatore_id as string | null) ?? null,
    ore_totali: Number(c.ore_totali),
    ore_tutoraggio: c.ore_tutoraggio != null ? Number(c.ore_tutoraggio) : null,
    tutor_previsto: Boolean(c.tutor_previsto),
    calendario_inviato_at: (c.calendario_inviato_at as string | null) ?? null,
    calendario_confermato: (c.calendario_confermato as boolean | null) ?? null,
    stato_assegnazione: (c.stato_assegnazione as string | null) ?? null,
    accettazione_risposta_at: (c.accettazione_risposta_at as string | null) ?? null,
  }))

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
    >
      <DashboardClient
        progetti={progetti}
        corsi={corsi}
        finanziamenti={finanziamentiRaw || []}
        oreCompletatePerCorso={oreCompletatePerCorso}
        orePianificatePerCorso={orePianificatePerCorso}
        oreErogatePerProgetto={oreErogatePerProgetto}
        thisMonthStart={thisMonthStart.toISOString()}
      />
    </AppLayout>
  )
}
