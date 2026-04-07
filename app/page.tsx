import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Root page: redirect based on session.
// - Not logged in → /login
// - super_admin / admin → /dashboard
// - formatore → /formatore
// - tutor → /tutor
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'tutor') {
    redirect('/tutor')
  }

  if (profile?.role === 'formatore') {
    redirect('/formatore')
  }

  redirect('/dashboard')
}
