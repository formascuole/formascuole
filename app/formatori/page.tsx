import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { FormatoriClient } from './FormatoriClient'

export default async function FormatoriPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = profile.role === 'super_admin'

  // Fetch all non-super_admin users (formatori, tutori, admins)
  const { data: utenti } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['formatore', 'tutor', 'admin'])
    .order('nome')

  // Fetch all corsi (both formatore_id and tutor_id) for stats
  const { data: corsiAll } = await supabase
    .from('corsi_con_ore')
    .select('formatore_id, tutor_id, ore_totali, ore_pianificate')

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  const utentiConStats = (utenti || []).map(u => {
    // A user may be formatore or tutor on a corso
    const corsi = (corsiAll || []).filter(c =>
      c.formatore_id === u.id || c.tutor_id === u.id
    )
    const oreTotali = corsi.reduce((s, c) => s + Number(c.ore_totali), 0)
    const orePianificate = corsi.reduce((s, c) => s + Number(c.ore_pianificate), 0)
    const pct = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0
    return { ...u, n_corsi: corsi.length, oreTotali, orePianificate, pct }
  })

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
    >
      <FormatoriClient utenti={utentiConStats} isSuperAdmin={isSuperAdmin} />
    </AppLayout>
  )
}
