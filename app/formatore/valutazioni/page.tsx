import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { ValutazioniFormatoreClient } from './ValutazioniFormatoreClient'

export default async function ValutazioniFormatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (!['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  const { data: corsi } = await admin
    .from('corsi_con_ore')
    .select('id, title, project_id')
    .eq('formatore_id', user.id)
    .order('created_at')

  const corsiIds = (corsi || []).map(c => c.id)

  const projectIds = [...new Set((corsi || []).map(c => c.project_id))]
  let progettiMap = new Map<string, { school_name: string }>()
  if (projectIds.length > 0) {
    const { data: progettiData } = await admin
      .from('progetti')
      .select('id, school_name')
      .in('id', projectIds)
    for (const p of progettiData || []) progettiMap.set(p.id, p)
  }

  const corsiConScuola = (corsi || []).map(c => ({
    id: c.id,
    title: c.title as string,
    school_name: progettiMap.get(c.project_id)?.school_name || '',
  }))

  // Query both by corso_id (platform submissions) and by formatore name (direct submissions)
  const [byCorso, byName] = await Promise.all([
    corsiIds.length > 0
      ? admin.from('questionari_risultati').select('*')
          .in('corso_id', corsiIds)
          .not('media_formatore', 'is', null)
          .not('media_contenuti', 'is', null)
          .not('media_apprendimento', 'is', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as import('@/lib/types').QuestionarioRisultato[] }),
    admin.from('questionari_risultati').select('*')
      .eq('formatore', profile.nome)
      .not('media_formatore', 'is', null)
      .not('media_contenuti', 'is', null)
      .not('media_apprendimento', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  const seen = new Set<string>()
  const questionari = [...(byCorso.data || []), ...(byName.data || [])]
    .filter(q => { if (seen.has(q.id)) return false; seen.add(q.id); return true })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      <ValutazioniFormatoreClient
        questionari={questionari || []}
        corsi={corsiConScuola}
        formatoreName={profile.nome}
      />
    </AppLayout>
  )
}
