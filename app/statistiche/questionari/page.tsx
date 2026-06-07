import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { QuestionariStatClient } from './QuestionariStatClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

export default async function QuestionariStatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)

  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()
  const { data: questionari } = await admin
    .from('questionari_risultati')
    .select('*')
    .not('media_formatore', 'is', null)
    .not('media_contenuti', 'is', null)
    .not('media_apprendimento', 'is', null)
    .order('created_at', { ascending: false })

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <QuestionariStatClient questionari={questionari || []} />
    </AppLayout>
  )
}
