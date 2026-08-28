import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgettiClient } from './ProgettiClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

export default async function ProgettiPage({ searchParams }: { searchParams: Promise<{ in_attesa?: string }> }) {
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

  const { in_attesa } = await searchParams

  const admin = createAdminClient()
  const [{ data: progetti }, { data: finanziamenti }, { data: partners }, notifiche] = await Promise.all([
    supabase.from('progetti_con_stats').select('*').order('created_at', { ascending: false }),
    supabase.from('finanziamenti').select('*').order('nome'),
    admin.from('partners').select('id,nome').order('nome'),
    getUnreadNotificheCount(supabase, user.id),
  ])

  // If filtering by in_attesa, fetch the project IDs that have pending corsi
  let inAttesaProjectIds: string[] | undefined
  if (in_attesa === '1') {
    const { data: pendingCorsi } = await supabase
      .from('corsi')
      .select('project_id')
      .eq('stato_assegnazione', 'in_attesa')
    inAttesaProjectIds = [...new Set((pendingCorsi || []).map(c => c.project_id as string))]
  }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <ProgettiClient
        progetti={progetti || []}
        finanziamenti={finanziamenti || []}
        partners={partners || []}
        inAttesaProjectIds={inAttesaProjectIds}
        isAdmin={['admin', 'super_admin'].includes(profile.role)}
      />
    </AppLayout>
  )
}
