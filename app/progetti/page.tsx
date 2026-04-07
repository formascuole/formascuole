import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgettiClient } from './ProgettiClient'

export default async function ProgettiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin','super_admin'].includes(profile.role)) redirect('/formatore')

  const { data: superAdminRow } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', user.id)
    .eq('role', 'super_admin')
    .maybeSingle()
  const isSuperAdmin = profile.role === 'super_admin' || !!superAdminRow

  const [{ data: progetti }, { data: finanziamenti }, { count: notifiche }] = await Promise.all([
    supabase.from('progetti_con_stats').select('*').order('created_at', { ascending: false }),
    supabase.from('finanziamenti').select('*').order('nome'),
    supabase.from('solleciti_log').select('*', { count: 'exact', head: true }).eq('tipo', 'sollecito_3'),
  ])

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
      isSuperAdmin={isSuperAdmin}
    >
      <ProgettiClient progetti={progetti || []} finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
