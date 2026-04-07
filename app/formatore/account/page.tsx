import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { AccountClient } from './AccountClient'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile && profile.role !== 'formatore') redirect('/dashboard')

  return (
    <AppLayout
      role="formatore"
      nome={profile?.nome ?? user.email ?? ''}
      email={profile?.email ?? user.email ?? ''}
      avatarInitials={profile?.avatar_initials ?? '??'}
    >
      <AccountClient
        nome={profile?.nome ?? ''}
        email={profile?.email ?? user.email ?? ''}
        avatarInitials={profile?.avatar_initials ?? '??'}
        createdAt={profile?.created_at ?? ''}
      />
    </AppLayout>
  )
}
