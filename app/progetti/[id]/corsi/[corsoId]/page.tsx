import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { CorsoDetailClient } from './CorsoDetailClient'

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

  // Fetch formatore and tutor in parallel via their IDs
  const [{ data: formatore }, { data: tutor }] = await Promise.all([
    corsoData.formatore_id
      ? supabase.from('profiles').select('id,nome,email,avatar_initials').eq('id', corsoData.formatore_id).single()
      : Promise.resolve({ data: null }),
    corsoData.tutor_id
      ? supabase.from('profiles').select('id,nome,email,avatar_initials').eq('id', corsoData.tutor_id).single()
      : Promise.resolve({ data: null }),
  ])

  const corso = { ...corsoData, formatore, tutor }

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

  const { data: formatori } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'formatore')
    .order('nome')

  const { data: tutori } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'tutor')
    .order('nome')

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
        formatori={formatori || []}
        tutori={tutori || []}
        note={note || []}
        progettoId={id}
        currentUserId={user.id}
        isAdmin={true}
      />
    </AppLayout>
  )
}
