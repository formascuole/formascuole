import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { NotuleAdminClient } from './NotuleAdminClient'
import type { Notula } from '@/lib/types'

export interface NotuleAdminItem extends Notula {
  formatore_nome: string
  formatore_email: string
  n_corsi: number
}

export default async function NotuleAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()

  const { data: notuleRaw } = await admin
    .from('notule')
    .select('*, formatore:profiles!formatore_id(id, nome, email), corsi:notule_corsi(corso_id, importo, ore_erogate)')
    .order('created_at', { ascending: false })

  const notule: NotuleAdminItem[] = (notuleRaw || []).map(n => ({
    id: n.id as string,
    numero: n.numero as string,
    formatore_id: n.formatore_id as string,
    stato: n.stato as 'bozza' | 'inviata' | 'accettata' | 'rifiutata',
    tipo: n.tipo as 'singola' | 'cumulativa',
    importo_totale: n.importo_totale as number | null,
    ritenuta: n.ritenuta as number | null,
    iva: (n.iva as number) ?? 0,
    netto: n.netto as number | null,
    pdf_url: n.pdf_url as string | null,
    token: n.token as string | null,
    inviata_at: n.inviata_at as string | null,
    risposta_at: n.risposta_at as string | null,
    motivazione_rifiuto: n.motivazione_rifiuto as string | null,
    created_at: n.created_at as string,
    formatore_nome: (n.formatore as { nome: string } | null)?.nome ?? '—',
    formatore_email: (n.formatore as { email: string } | null)?.email ?? '—',
    n_corsi: Array.isArray(n.corsi) ? n.corsi.length : 0,
  }))

  const formatori = Array.from(
    new Map(notule.map(n => [n.formatore_id, { id: n.formatore_id, nome: n.formatore_nome }])).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <NotuleAdminClient notule={notule} formatori={formatori} />
    </AppLayout>
  )
}
