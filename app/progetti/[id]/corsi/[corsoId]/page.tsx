import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { CorsoDetailClient } from './CorsoDetailClient'
import { Profile } from '@/lib/types'

export default async function CorsoDetailPage({
  params,
}: {
  params: Promise<{ id: string; corsoId: string }>
}) {
  const { id, corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin','super_admin'].includes(profile.role)) redirect('/formatore')

  // Fetch the corso without profile joins — PostgREST can't reliably disambiguate
  // two FKs pointing to the same table (formatore_id and tutor_id both → profiles)
  const { data: corsoData } = await supabase
    .from('corsi_con_ore')
    .select('*')
    .eq('id', corsoId)
    .single()

  if (!corsoData || corsoData.project_id !== id) notFound()

  // Fetch formatore, tutor, and referente in parallel via their IDs
  const [{ data: formatore }, { data: tutor }, { data: referente }] = await Promise.all([
    corsoData.formatore_id
      ? supabase.from('profiles').select('id,nome,email,avatar_initials').eq('id', corsoData.formatore_id).single()
      : Promise.resolve({ data: null }),
    corsoData.tutor_id
      ? supabase.from('profiles').select('id,nome,email,avatar_initials').eq('id', corsoData.tutor_id).single()
      : Promise.resolve({ data: null }),
    corsoData.referente_id
      ? supabase.from('referenti_progetto').select('*').eq('id', corsoData.referente_id).single()
      : Promise.resolve({ data: null }),
  ])

  const corso = { ...corsoData, formatore, tutor, referente }

  const { data: progetto } = await supabase
    .from('progetti')
    .select('school_name,anno_scolastico,ref_name,ref_email')
    .eq('id', id)
    .single()

  const { data: sessioni } = await supabase
    .from('sessioni')
    .select('*')
    .eq('corso_id', corsoId)
    .order('data')

  // Fetch formatori and tutori via profiles_roles to catch dual-role users
  const [{ data: formatoreRoles }, { data: tutorRoles }] = await Promise.all([
    supabase.from('profiles_roles').select('profile_id').eq('role', 'formatore'),
    supabase.from('profiles_roles').select('profile_id').eq('role', 'tutor'),
  ])

  const formatoreIds = new Set((formatoreRoles || []).map((r: { profile_id: string }) => r.profile_id))
  const tutorIds = new Set((tutorRoles || []).map((r: { profile_id: string }) => r.profile_id))
  const dualRoleIds = [...formatoreIds].filter(pid => tutorIds.has(pid))

  const allProfileIds = [...new Set([...formatoreIds, ...tutorIds])]
  let formatori: Profile[] = []
  let tutori: Profile[] = []
  if (allProfileIds.length > 0) {
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', allProfileIds)
      .order('nome')
    formatori = (allProfiles || []).filter((p: Profile) => formatoreIds.has(p.id))
    tutori = (allProfiles || []).filter((p: Profile) => tutorIds.has(p.id))
  }

  // Fetch referenti for the project
  const { data: referenti } = await supabase
    .from('referenti_progetto')
    .select('*')
    .eq('progetto_id', id)
    .order('created_at')

  const { data: note } = await supabase
    .from('note_corso')
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .eq('corso_id', corsoId)
    .order('created_at', { ascending: true })

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
      <CorsoDetailClient
        corso={corso}
        progetto={progetto}
        sessioni={sessioni || []}
        formatori={formatori}
        tutori={tutori}
        dualRoleIds={dualRoleIds}
        referenti={referenti || []}
        note={note || []}
        progettoId={id}
        currentUserId={user.id}
        isAdmin={true}
        canConfirmSessions={true}
        isSuperAdmin={profile.role === 'super_admin'}
      />
    </AppLayout>
  )
}
