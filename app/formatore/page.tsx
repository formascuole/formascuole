import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { FormatoreClient } from './FormatoreClient'
import { NoProfileError } from './NoProfileError'

export default async function FormatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (profile && profile.role === 'tutor') redirect('/tutor')
  if (profile && !['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  if (!profile) {
    return <NoProfileError />
  }

  // Finanziamenti: lettura libera per tutti gli autenticati (RLS consente)
  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('id,nome')
    .order('nome')

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      {/* I corsi sono caricati client-side via /api/formatore/corsi (bypassa RLS) */}
      <FormatoreClient profile={profile} finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
