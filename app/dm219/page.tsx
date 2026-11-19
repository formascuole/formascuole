import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { Dm219ListClient } from './Dm219ListClient'

export default async function Dm219Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'super_admin'].includes(profile?.role ?? '')) redirect('/dashboard')

  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  return (
    <AppLayout role={profile?.role} notifiche={notifiche}>
      <Dm219ListClient />
    </AppLayout>
  )
}
