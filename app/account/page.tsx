import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
import { AccountClient } from './AccountClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { getLettereCount } from '@/lib/get-lettere-count'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)

  const notifiche = ['admin', 'super_admin'].includes(profile.role)
    ? await getUnreadNotificheCount(supabase, user.id)
    : 0

  let lettereCount: number | undefined
  if (['formatore', 'tutor'].includes(profile.role)) {
    const admin = createAdminClient()
    lettereCount = await getLettereCount(admin, user.id, profile.role as 'formatore' | 'tutor')
  }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
      regimeFiscale={profile.regime_fiscale}
      lettereCount={lettereCount}
    >
      <AccountClient
        nome={profile.nome}
        email={profile.email}
        role={profile.role}
        avatarInitials={profile.avatar_initials}
        createdAt={profile.created_at}
        luogo_nascita={profile.luogo_nascita ?? null}
        data_nascita={profile.data_nascita ?? null}
        codice_fiscale={profile.codice_fiscale ?? null}
        indirizzo_via={profile.indirizzo_via ?? null}
        indirizzo_cap={profile.indirizzo_cap ?? null}
        indirizzo_citta={profile.indirizzo_citta ?? null}
        indirizzo_provincia={profile.indirizzo_provincia ?? null}
        iban={profile.iban ?? null}
        banca={profile.banca ?? null}
        intestatario_conto={profile.intestatario_conto ?? null}
        tariffa_oraria_formatore={profile.tariffa_oraria_formatore ?? null}
        tariffa_oraria_tutor={profile.tariffa_oraria_tutor ?? null}
        ha_partita_iva={profile.ha_partita_iva ?? false}
        regime_fiscale={(profile.regime_fiscale ?? 'notula') as 'forfettario' | 'ordinario' | 'notula'}
        rivalsa_iva={profile.rivalsa_iva ?? false}
        partita_iva={profile.partita_iva ?? null}
        telefono={profile.telefono ?? null}
        regione={profile.regione ?? null}
        inps_gestione_separata={profile.inps_gestione_separata ?? false}
      />
    </AppLayout>
  )
}
