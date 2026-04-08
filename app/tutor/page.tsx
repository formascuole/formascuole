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

  // Finanziamenti: lettura libera per tutti gli autenticati (RLS consente)
  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('id,nome')
    .order('nome')

  return (
    <AppLayout
      role="tutor"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
    >
      {/* I corsi sono caricati client-side via /api/tutor/corsi (bypassa RLS) */}
      <TutorClient profile={profile} finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
