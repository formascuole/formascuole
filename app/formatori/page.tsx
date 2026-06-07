import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { FormatoriClient } from './FormatoriClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

export default async function FormatoriPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)

  // Fetch all non-super_admin users (formatori, tutori, admins)
  const { data: utenti } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['formatore', 'tutor', 'admin'])
    .order('nome')

  // Fetch all assigned roles so the edit modal can pre-check the right boxes
  const { data: allRoles } = await supabase
    .from('profiles_roles')
    .select('profile_id, role')
    .in('profile_id', (utenti || []).map(u => u.id))

  // Group roles by profile_id
  const rolesByUser = new Map<string, string[]>()
  for (const row of allRoles || []) {
    if (!rolesByUser.has(row.profile_id)) rolesByUser.set(row.profile_id, [])
    rolesByUser.get(row.profile_id)!.push(row.role)
  }

  // Stats (zeros) — populated client-side via /api/utenti/stats (service role, bypasses RLS)
  const utentiConStats = (utenti || []).map(u => ({
    ...u,
    roles: (rolesByUser.get(u.id) ?? [u.role]) as string[],
    n_corsi_formatore: 0,
    ore_formatore: 0,
    n_corsi_tutor: 0,
    ore_tutor: 0,
    pct: 0,
  }))

  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
    >
      <FormatoriClient utenti={utentiConStats} isSuperAdmin={isSuperAdmin} />
    </AppLayout>
  )
}
