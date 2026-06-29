import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { PartnersClient } from './PartnersClient'

export default async function PartnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()
  const { data: partners } = await admin.from('partners').select('*').order('nome')

  // Fetch how many projects each partner has
  const { data: progettiPartner } = await admin
    .from('progetti')
    .select('partner_id')
    .not('partner_id', 'is', null)

  const partnerProgettiCount: Record<string, number> = {}
  for (const p of progettiPartner ?? []) {
    if (p.partner_id) {
      partnerProgettiCount[p.partner_id] = (partnerProgettiCount[p.partner_id] ?? 0) + 1
    }
  }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <PartnersClient
        partners={partners ?? []}
        partnerProgettiCount={partnerProgettiCount}
      />
    </AppLayout>
  )
}
