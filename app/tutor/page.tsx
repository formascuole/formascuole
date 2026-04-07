import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { TutorClient } from './TutorClient'

export default async function TutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (profile.role !== 'tutor') redirect('/formatore')

  // Fetch corsi where this user is tutor
  const { data: corsi } = await supabase
    .from('corsi_con_ore')
    .select(`
      *,
      progetti:progetti(school_name, anno_scolastico, ref_name, ref_email),
      formatore:profiles!formatore_id(id,nome,email,avatar_initials)
    `)
    .eq('tutor_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AppLayout
      role="tutor"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
    >
      <TutorClient corsi={corsi || []} profile={profile} />
    </AppLayout>
  )
}
