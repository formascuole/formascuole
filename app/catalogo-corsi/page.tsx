import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { CatalogoClient } from './CatalogoClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

export default async function CatalogoCorsiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)

  const [{ data: corsi }, { data: finanziamenti }, notifiche] = await Promise.all([
    supabase.from('catalogo_corsi').select('*').order('titolo'),
    supabase.from('finanziamenti').select('id, nome').eq('attivo', true).order('nome'),
    getUnreadNotificheCount(supabase, user.id),
  ])

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <CatalogoClient initialCorsi={corsi || []} isSuperAdmin={isSuperAdmin} finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
