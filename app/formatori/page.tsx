import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { FormatoriClient } from './FormatoriClient'

export default async function FormatoriPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/formatore')

  const { data: formatori } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'formatore')
    .order('nome')

  const { data: corsiAll } = await supabase
    .from('corsi_con_ore')
    .select('*')
    .not('formatore_id', 'is', null)

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  const formatoriConStats = (formatori || []).map(f => {
    const corsi = (corsiAll || []).filter((c: { formatore_id: string }) => c.formatore_id === f.id)
    const oreTotali = corsi.reduce((s: number, c: { ore_totali: number }) => s + Number(c.ore_totali), 0)
    const orePianificate = corsi.reduce((s: number, c: { ore_pianificate: number }) => s + Number(c.ore_pianificate), 0)
    const pct = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0
    return { ...f, n_corsi: corsi.length, oreTotali, orePianificate, pct }
  })

  return (
    <AppLayout role="admin" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials} notificheBadge={notifiche || 0}>
      <FormatoriClient formatoriConStats={formatoriConStats} />
    </AppLayout>
  )
}
