import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { CorsoDetailClient } from './CorsoDetailClient'
import { Profile } from '@/lib/types'
import { createAdminClient } from '@/lib/supabase/admin'

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
  if (!profile) redirect('/login')

  const isAdmin = ['admin', 'super_admin'].includes(profile.role)
  const isFormatore = profile.role === 'formatore'
  const isTutor = profile.role === 'tutor'

  // Solo admin, formatori e tutori possono accedere
  if (!isAdmin && !isFormatore && !isTutor) redirect('/formatore')

  const { data: superAdminRow } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', user.id)
    .eq('role', 'super_admin')
    .maybeSingle()
  const isSuperAdmin = profile.role === 'super_admin' || !!superAdminRow

  // Fetch the corso
  const { data: corsoData } = await supabase
    .from('corsi_con_ore')
    .select('*')
    .eq('id', corsoId)
    .single()

  if (!corsoData || corsoData.project_id !== id) notFound()

  // Formatori e tutori possono vedere solo i propri corsi
  if (!isAdmin) {
    const hasAccess = corsoData.formatore_id === user.id || corsoData.tutor_id === user.id
    if (!hasAccess) redirect(isFormatore ? '/formatore' : '/tutor')
  }

  // Fetch formatore, tutor, referente in parallel
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
    .select('school_name,anno_scolastico,ref_name,ref_email,finanziamento_id')
    .eq('id', id)
    .single()

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('id,nome')

  const finanziamentoNome = progetto?.finanziamento_id
    ? (finanziamenti || []).find(f => f.id === progetto.finanziamento_id)?.nome || null
    : null

  const { data: sessioni } = await supabase
    .from('sessioni')
    .select('*')
    .eq('corso_id', corsoId)
    .order('data')

  // Solo gli admin vedono i picker formatori/tutori
  let formatori: Profile[] = []
  let tutori: Profile[] = []
  let dualRoleIds: string[] = []
  if (isAdmin) {
    const [{ data: formatoreRoles }, { data: tutorRoles }] = await Promise.all([
      supabase.from('profiles_roles').select('profile_id').eq('role', 'formatore'),
      supabase.from('profiles_roles').select('profile_id').eq('role', 'tutor'),
    ])
    const formatoreIds = new Set((formatoreRoles || []).map((r: { profile_id: string }) => r.profile_id))
    const tutorIds = new Set((tutorRoles || []).map((r: { profile_id: string }) => r.profile_id))
    dualRoleIds = [...formatoreIds].filter(pid => tutorIds.has(pid))
    const allProfileIds = [...new Set([...formatoreIds, ...tutorIds])]
    if (allProfileIds.length > 0) {
      const { data: allProfiles } = await supabase.from('profiles').select('*').in('id', allProfileIds).order('nome')
      formatori = (allProfiles || []).filter((p: Profile) => formatoreIds.has(p.id))
      tutori = (allProfiles || []).filter((p: Profile) => tutorIds.has(p.id))
    }
  }

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

  const { count: notifiche } = isAdmin
    ? await supabase.from('solleciti_log').select('*', { count: 'exact', head: true }).eq('tipo', 'sollecito_3')
    : { count: 0 }

  // Candidature (admin only)
  const adminQ = createAdminClient()
  const { data: candidature } = isAdmin
    ? await adminQ
        .from('candidature_corsi')
        .select('id, formatore_id, note, stato, created_at, formatore:profiles!formatore_id(id, nome, email, avatar_initials)')
        .eq('corso_id', corsoId)
        .order('created_at')
    : { data: [] }

  // Questionari — use admin client to bypass RLS for formatori
  const { data: questionari } = await adminQ
    .from('questionari_risultati')
    .select('*')
    .eq('corso_id', corsoId)
    .not('media_formatore', 'is', null)
    .not('media_contenuti', 'is', null)
    .not('media_apprendimento', 'is', null)
    .order('created_at', { ascending: false })

  // Il formatore assegnato può confermare le sessioni
  const canConfirmSessions = isAdmin || corsoData.formatore_id === user.id

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
      isSuperAdmin={isSuperAdmin}
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
        questionari={questionari || []}
        candidature={(candidature || []) as unknown as import('@/lib/types').Candidatura[]}
        progettoId={id}
        currentUserId={user.id}
        isAdmin={isAdmin}
        canConfirmSessions={canConfirmSessions}
        isSuperAdmin={isSuperAdmin}
        finanziamentoNome={finanziamentoNome}
      />
    </AppLayout>
  )
}
