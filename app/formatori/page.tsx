import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { FormatoriClient } from './FormatoriClient'

export default async function FormatoriPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  // Check super_admin via profiles_roles (source of truth) in addition to profiles.role
  const { data: superAdminRow } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', user.id)
    .eq('role', 'super_admin')
    .maybeSingle()

  const isSuperAdmin = profile.role === 'super_admin' || !!superAdminRow

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

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
    >
      <FormatoriClient utenti={utentiConStats} isSuperAdmin={isSuperAdmin} />
    </AppLayout>
  )
}
