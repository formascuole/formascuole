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

  const { data: superAdminRow } = await supabase
    .from('profiles_roles')
    .select('role')
    .eq('profile_id', user.id)
    .eq('role', 'super_admin')
    .maybeSingle()
  const isSuperAdmin = currentProfile.role === 'super_admin' || !!superAdminRow

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

  // Fetch rifiutati by this user (formatore_id was nulled; find via solleciti_log)
  const { data: rifiutiLog } = await supabase
    .from('solleciti_log')
    .select('corso_id')
    .eq('formatore_id', id)
    .eq('tipo', 'assegnazione')

  const rifiutatiCorsiIds = (rifiutiLog || []).map(l => l.corso_id)
  let nRifiutati = 0
  if (rifiutatiCorsiIds.length > 0) {
    const { count } = await supabase
      .from('corsi')
      .select('*', { count: 'exact', head: true })
      .eq('stato_assegnazione', 'rifiutato')
      .in('id', rifiutatiCorsiIds)
    nRifiutati = count ?? 0
  }

  const nAccettati = (corsiFormatore || []).filter(c => c.stato_assegnazione === 'accettato').length
  const totRisposte = nAccettati + nRifiutati
  const tassoAccettazione = totRisposte > 0 ? Math.round((nAccettati / totRisposte) * 100) : null

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
        isSuperAdmin={isSuperAdmin}
        currentUserId={user.id}
        nRifiutati={nRifiutati}
        tassoAccettazione={tassoAccettazione}
      />
    </AppLayout>
  )
}
