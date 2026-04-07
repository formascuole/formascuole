import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { FinanziamentiClient } from './FinanziamentiClient'

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

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  return (
    <AppLayout
      role={profile!.role}
      nome={profile!.nome}
      email={profile!.email}
      avatarInitials={profile!.avatar_initials}
      notificheBadge={notifiche || 0}
      isSuperAdmin={true}
    >
      <FinanziamentiClient finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
