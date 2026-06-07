import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { FinanziamentiClient } from './FinanziamentiClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

export default async function FinanziamentiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: superAdminRow } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', user.id)
    .eq('role', 'super_admin')
    .maybeSingle()
  const isSuperAdmin = profile?.role === 'super_admin' || !!superAdminRow

  // Solo super_admin può accedere
  if (!isSuperAdmin) redirect('/dashboard')

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('*')
    .order('nome')

  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  return (
    <AppLayout
      role={profile!.role}
      nome={profile!.nome}
      email={profile!.email}
      avatarInitials={profile!.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={true}
    >
      <FinanziamentiClient finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
