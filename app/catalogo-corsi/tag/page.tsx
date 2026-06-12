import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { TagsClient } from './TagsClient'

export default async function TagsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')
  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)
  const admin = createAdminClient()
  const { data: tags } = await admin.from('tags').select('*').order('nome')
  // Fetch usage counts
  const [{ data: corsiTagsData }, { data: skillsData }] = await Promise.all([
    admin.from('corsi_tags').select('tag_id'),
    admin.from('formatori_skills').select('tag_id'),
  ])
  const usageMap: Record<string, number> = {}
  for (const r of (corsiTagsData || [])) usageMap[r.tag_id] = (usageMap[r.tag_id] ?? 0) + 1
  for (const r of (skillsData || [])) usageMap[r.tag_id] = (usageMap[r.tag_id] ?? 0) + 1
  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <TagsClient initialTags={tags || []} usageMap={usageMap} isSuperAdmin={isSuperAdmin} />
    </AppLayout>
  )
}
