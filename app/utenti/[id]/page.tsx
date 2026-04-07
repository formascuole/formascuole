import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { UtenteDetailClient } from './UtenteDetailClient'
import { UserRole } from '@/lib/types'

export default async function UtenteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!currentProfile || !['admin', 'super_admin'].includes(currentProfile.role)) redirect('/formatore')

  // Fetch the target user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  // Fetch all roles for this user
  const { data: roleRows } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', id)

  const roles = (roleRows && roleRows.length > 0
    ? roleRows.map((r: { role: string }) => r.role)
    : [profile.role]) as UserRole[]

  // Fetch corsi where this user is formatore
  const { data: corsiFormatore } = await supabase
    .from('corsi_con_ore')
    .select('*, project:progetti(id,school_name,anno_scolastico)')
    .eq('formatore_id', id)
    .order('created_at', { ascending: false })

  // Fetch corsi where this user is tutor
  const { data: corsiTutor } = await supabase
    .from('corsi_con_ore')
    .select('*, project:progetti(id,school_name,anno_scolastico)')
    .eq('tutor_id', id)
    .order('created_at', { ascending: false })

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  return (
    <AppLayout
      role={currentProfile.role}
      nome={currentProfile.nome}
      email={currentProfile.email}
      avatarInitials={currentProfile.avatar_initials}
      notificheBadge={notifiche || 0}
    >
      <UtenteDetailClient
        profile={{ ...profile, roles }}
        corsiFormatore={corsiFormatore || []}
        corsiTutor={corsiTutor || []}
      />
    </AppLayout>
  )
}
