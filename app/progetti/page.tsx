import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgettiClient } from './ProgettiClient'

export default async function ProgettiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/formatore')

  const { data: progetti } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .order('created_at', { ascending: false })

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  return (
    <AppLayout
      role="admin"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
    >
      <ProgettiClient progetti={progetti || []} />
    </AppLayout>
  )
}
