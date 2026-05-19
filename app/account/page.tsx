import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AccountClient } from './AccountClient'

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

  const { count: notifiche } = ['admin', 'super_admin'].includes(profile.role)
    ? await supabase
        .from('solleciti_log')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'sollecito_3')
    : { count: 0 }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
      isSuperAdmin={isSuperAdmin}
    >
      <AccountClient
        nome={profile.nome}
        email={profile.email}
        role={profile.role}
        avatarInitials={profile.avatar_initials}
        createdAt={profile.created_at}
      />
    </AppLayout>
  )
}
