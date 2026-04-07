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

  // SAFE guard: only redirect when we POSITIVELY know the role is 'admin'.
  // If profile is null (DB not migrated, trigger missing, RLS issue) we stay
  // here and show an error. Redirecting to /dashboard would cause an infinite
  // loop because dashboard/page.tsx does:
  //   if (!profile || role !== 'admin') redirect('/formatore')
  // and then we'd redirect back, and so on.
  // Redirect non-formatori to the appropriate home
  if (profile && profile.role === 'tutor') redirect('/tutor')
  if (profile && !['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  if (!profile) {
    return <NoProfileError />
  }

  const { data: corsi } = await supabase
    .from('corsi_con_ore')
    .select('*, progetti(school_name,anno_scolastico,ref_name,ref_email)')
    .eq('formatore_id', user.id)
    .order('created_at')

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      <FormatoreClient corsi={corsi || []} profile={profile} />
    </AppLayout>
  )
}
