import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { calcFinancials } from '@/lib/economia-utils'
import { EstrattiContoClient } from './EstrattiContoClient'

export interface CorsoECItem {
  corso_id: string
  title: string
  school_name: string
  formatore_id: string
  formatore_nome: string
  regime_fiscale: 'forfettario' | 'ordinario' | 'notula'
  rivalsa_iva: boolean
  tariffa: number | null         // effective: corso.tariffa_oraria ?? profile.tariffa_oraria_formatore
  tariffa_oraria_formatore: number | null  // profile default
  ore_erogate: number
  anno: string | null            // year from corso_completato_at or ultima_sessione
  prima_sessione: string | null
  ultima_sessione: string | null
  imponibile: number
  ritenuteIva: number
  netto: number
}

export default async function EstrattiContoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()

  const [
    { data: profilesRaw },
    { data: corsiRaw },
    { data: progettiRaw },
    { data: sessioniRaw },
  ] = await Promise.all([
    admin.from('profiles').select('id, nome, tariffa_oraria_formatore, regime_fiscale, rivalsa_iva').in('role', ['formatore', 'admin', 'super_admin']),
    admin.from('corsi').select('id, project_id, title, formatore_id, corso_completato, corso_completato_at, tariffa_oraria').eq('corso_completato', true).not('formatore_id', 'is', null),
    admin.from('progetti').select('id, school_name'),
    admin.from('sessioni').select('corso_id, ore, data').eq('completata', true),
  ])

  const profiles = profilesRaw || []
  const corsi = corsiRaw || []
  const progetti = progettiRaw || []
  const sessioni = sessioniRaw || []

  const profilesMap = new Map(profiles.map(p => [p.id, p]))
  const progettiMap = new Map(progetti.map(p => [p.id, p]))

  type SessionAgg = { ore_erogate: number; prima: string | null; ultima: string | null }
  const sessionByCorso = new Map<string, SessionAgg>()
  for (const s of sessioni) {
    const cur = sessionByCorso.get(s.corso_id) ?? { ore_erogate: 0, prima: null, ultima: null }
    cur.ore_erogate += Number(s.ore)
    if (!cur.prima || s.data < cur.prima) cur.prima = s.data
    if (!cur.ultima || s.data > cur.ultima) cur.ultima = s.data
    sessionByCorso.set(s.corso_id, cur)
  }

  const items: CorsoECItem[] = corsi.map(c => {
    const profileData = profilesMap.get(c.formatore_id!)
    const progetto = progettiMap.get(c.project_id)
    const agg = sessionByCorso.get(c.id) ?? { ore_erogate: 0, prima: null, ultima: null }
    const regime = ((profileData?.regime_fiscale ?? 'notula') as 'forfettario' | 'ordinario' | 'notula')
    const rivalsa = profileData?.rivalsa_iva ?? false
    const tariffaProfile = (profileData?.tariffa_oraria_formatore as number | null) ?? null
    const tariffa = (c.tariffa_oraria as number | null) ?? tariffaProfile
    const anno = (c.corso_completato_at as string | null)?.substring(0, 4) ?? agg.ultima?.substring(0, 4) ?? null
    const fin = tariffa != null && agg.ore_erogate > 0
      ? calcFinancials(agg.ore_erogate, tariffa, regime, rivalsa)
      : { imponibile: 0, ritenuteIva: 0, netto: 0 }
    return {
      corso_id: c.id,
      title: c.title,
      school_name: progetto?.school_name ?? '—',
      formatore_id: c.formatore_id!,
      formatore_nome: (profileData?.nome as string | null) ?? '—',
      regime_fiscale: regime,
      rivalsa_iva: rivalsa,
      tariffa,
      tariffa_oraria_formatore: tariffaProfile,
      ore_erogate: agg.ore_erogate,
      anno,
      prima_sessione: agg.prima,
      ultima_sessione: agg.ultima,
      ...fin,
    }
  })

  const formatori = Array.from(
    new Map(items.map(i => [i.formatore_id, { id: i.formatore_id, nome: i.formatore_nome }])).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <EstrattiContoClient items={items} formatori={formatori} />
    </AppLayout>
  )
}
