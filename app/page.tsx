import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Root page: redirect based on session.
// - Not logged in → /login
// - Admin → /dashboard
// - Formatore → /formatore
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

  if (profile?.role === 'formatore') {
    redirect('/formatore')
  }

  redirect('/dashboard')
}
