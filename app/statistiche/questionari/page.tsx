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
  const { data: questionariRaw } = await admin
    .from('questionari_risultati')
    .select('*')
    .not('media_formatore', 'is', null)
    .not('media_contenuti', 'is', null)
    .not('media_apprendimento', 'is', null)
    .order('created_at', { ascending: false })

  // Backfill null scuola/formatore/titolo_corso from linked corso + progetto
  let questionari = questionariRaw || []
  const missingCourseIds = [...new Set(
    questionari
      .filter(q => q.corso_id && (!q.scuola || !q.formatore || !q.titolo_corso))
      .map(q => q.corso_id as string)
  )]
  if (missingCourseIds.length > 0) {
    const { data: corsiData } = await admin
      .from('corsi')
      .select('id, title, project_id, formatore_id')
      .in('id', missingCourseIds)
    const corsiMap = new Map((corsiData || []).map(c => [c.id, c]))
    const projectIds = [...new Set((corsiData || []).map(c => c.project_id))]
    const formatoreIds = [...new Set((corsiData || []).filter(c => c.formatore_id).map(c => c.formatore_id as string))]
    const [{ data: progettiData }, { data: formatoriFetch }] = await Promise.all([
      projectIds.length > 0
        ? admin.from('progetti').select('id, school_name').in('id', projectIds)
        : Promise.resolve({ data: [] }),
      formatoreIds.length > 0
        ? admin.from('profiles').select('id, nome').in('id', formatoreIds)
        : Promise.resolve({ data: [] }),
    ])
    const progettiMap = new Map((progettiData || []).map(p => [p.id, p]))
    const formatoriMap = new Map((formatoriFetch || []).map(f => [f.id, f]))
    questionari = questionari.map(q => {
      if (!q.corso_id) return q
      const corso = corsiMap.get(q.corso_id)
      if (!corso) return q
      const progetto = progettiMap.get(corso.project_id)
      const fmt = corso.formatore_id ? formatoriMap.get(corso.formatore_id) : null
      return {
        ...q,
        scuola: q.scuola || (progetto as { school_name: string } | undefined)?.school_name || null,
        formatore: q.formatore || (fmt as { nome: string } | undefined)?.nome || null,
        titolo_corso: q.titolo_corso || corso.title || null,
      }
    })
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
      <QuestionariStatClient questionari={questionari} />
    </AppLayout>
  )
}
