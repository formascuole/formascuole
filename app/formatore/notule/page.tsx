import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotuleClient } from './NotuleClient'
import type { Notula } from '@/lib/types'

export default async function FormatoreNotulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (!['formatore', 'admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch corsi da fatturare (completati senza notula)
  const { data: corsiRaw } = await admin
    .from('corsi_con_ore')
    .select('id, title, project_id, formatore_id, corso_completato_at, tariffa_oraria, ore_erogate')
    .eq('formatore_id', user.id)
    .eq('corso_completato', true)
    .is('notula_id', null)

  const corsi = corsiRaw || []

  // Fetch progetti for school names
  const projectIds = [...new Set(corsi.map(c => c.project_id as string))]
  let progettiMap = new Map<string, string>()
  if (projectIds.length > 0) {
    const { data: progettiData } = await admin
      .from('progetti')
      .select('id, school_name')
      .in('id', projectIds)
    for (const p of progettiData || []) progettiMap.set(p.id, p.school_name as string)
  }

  // Fetch notule emesse
  const { data: notuleRaw } = await admin
    .from('notule')
    .select('*, corsi:notule_corsi(corso_id, importo, ore_erogate, tariffa_oraria, corso:corsi(id, title, project_id))')
    .eq('formatore_id', user.id)
    .order('created_at', { ascending: false })

  const notule = (notuleRaw || []) as Notula[]

  // Build corsi da fatturare with school_name and tariff info
  const corsiFatturabili = corsi.map(c => ({
    id: c.id as string,
    title: c.title as string,
    project_id: c.project_id as string,
    school_name: progettiMap.get(c.project_id as string) ?? '—',
    ore_erogate: Number(c.ore_erogate ?? 0),
    tariffa_oraria: c.tariffa_oraria != null ? Number(c.tariffa_oraria) : (profile.tariffa_oraria_formatore != null ? Number(profile.tariffa_oraria_formatore) : null),
  }))

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
    >
      <NotuleClient
        corsiFatturabili={corsiFatturabili}
        notule={notule}
        formatoreId={user.id}
        regimeFiscale={(profile.regime_fiscale as 'notula' | 'forfettario' | 'ordinario') ?? 'notula'}
        rivalsaIva={profile.rivalsa_iva ?? false}
      />
    </AppLayout>
  )
}
