import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { MapClient } from './MapClient'
import type { ProgettoConStats, Profile, Finanziamento } from '@/lib/types'

export default async function MappaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)
  const admin = createAdminClient()

  const [{ data: progettiRaw }, { data: formatoriRaw }, { data: finanziamentiRaw }] =
    await Promise.all([
      admin
        .from('progetti_con_stats')
        .select('*')
        .order('school_name'),
      admin
        .from('profiles')
        .select('id, nome, email, role, regione, indirizzo_via, indirizzo_citta, indirizzo_provincia, lat, lng')
        .in('role', ['formatore', 'tutor'])
        .order('nome'),
      admin
        .from('finanziamenti')
        .select('id, nome, descrizione, attivo, tariffa_formatore_ora, tariffa_tutor_ora, data_termine, created_at')
        .eq('attivo', true)
        .order('nome'),
    ])

  // Count corsi per formatore for the popup
  const { data: corsiStats } = await admin
    .from('corsi')
    .select('formatore_id')
    .not('formatore_id', 'is', null)

  const corsiPerFormatore: Record<string, number> = {}
  for (const c of corsiStats ?? []) {
    const fid = c.formatore_id as string
    corsiPerFormatore[fid] = (corsiPerFormatore[fid] ?? 0) + 1
  }

  const progetti = (progettiRaw ?? []) as ProgettoConStats[]
  const formatori = (formatoriRaw ?? []) as Profile[]
  const finanziamenti = (finanziamentiRaw ?? []) as Finanziamento[]

  const nProgettiSenzaCoord = progetti.filter(p => !p.lat || !p.lng).length
  const nFormatoriSenzaCoord = formatori.filter(f => !f.lat || !f.lng).length

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <MapClient
        progetti={progetti}
        formatori={formatori}
        finanziamenti={finanziamenti}
        corsiPerFormatore={corsiPerFormatore}
        isSuperAdmin={isSuperAdmin}
        nProgettiSenzaCoord={nProgettiSenzaCoord}
        nFormatoriSenzaCoord={nFormatoriSenzaCoord}
      />
    </AppLayout>
  )
}
