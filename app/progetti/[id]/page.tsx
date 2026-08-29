import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
import type { Partner } from '@/lib/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgettoDetailClient } from './ProgettoDetailClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

export default async function ProgettoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin','super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)

  const { data: progetto } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .eq('id', id)
    .single()

  if (!progetto) notFound()

  // progetti_con_stats is a static view — columns added after its creation
  // (partner_id, quota_progettazione) are not included; fetch from the base table.
  const { data: progettoBase } = await supabase
    .from('progetti')
    .select('partner_id, quota_progettazione, quota_progettazione_note')
    .eq('id', id)
    .single()

  const progettoFull = {
    ...progetto,
    partner_id: progettoBase?.partner_id ?? null,
    quota_progettazione: progettoBase?.quota_progettazione ?? null,
    quota_progettazione_note: progettoBase?.quota_progettazione_note ?? null,
  }

  const { data: corsi } = await supabase
    .from('corsi_con_ore')
    .select('*, formatore:profiles!formatore_id(id,nome,email,avatar_initials,telefono), tutor:profiles!tutor_id(id,nome,email,telefono)')
    .eq('project_id', id)
    .order('created_at')

  const { data: formatori } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'formatore')
    .order('nome')

  const { data: messaggi } = await supabase
    .from('chat_messaggi')
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .eq('progetto_id', id)
    .order('created_at', { ascending: true })

  // Fetch which messages the current user has read
  const msgIds = (messaggi || []).map(m => m.id)
  let readSet = new Set<string>()
  if (msgIds.length > 0) {
    const { data: letture } = await supabase
      .from('chat_letture')
      .select('messaggio_id')
      .eq('utente_id', user.id)
      .in('messaggio_id', msgIds)
    readSet = new Set((letture || []).map(l => l.messaggio_id))
  }
  const messaggiConLetto = (messaggi || []).map(m => ({ ...m, letto: readSet.has(m.id) }))

  const { data: referenti } = await supabase
    .from('referenti_progetto')
    .select('*')
    .eq('progetto_id', id)
    .order('created_at')

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('*')
    .order('nome')

  const { data: catalogo } = await supabase
    .from('catalogo_corsi')
    .select('*')
    .eq('attivo', true)
    .order('titolo')

  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  // Questionari e ore erogate per tutti i corsi di questo progetto
  const corsiIds = (corsi || []).map(c => c.id)
  const adminQ = createAdminClient()
  const { data: partners } = await adminQ.from('partners').select('id,nome,created_at').order('nome')
  const [{ data: questionari }, { data: sessioniErogate }, { data: corsiStatsFormatori }, { data: tutteSessioni }] = await Promise.all([
    corsiIds.length > 0
      ? adminQ.from('questionari_risultati').select('*').in('corso_id', corsiIds).not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    corsiIds.length > 0
      ? adminQ.from('sessioni').select('corso_id, ore').in('corso_id', corsiIds).eq('completata', true)
      : Promise.resolve({ data: [] }),
    (formatori?.length ?? 0) > 0
      ? adminQ.from('corsi').select('formatore_id, stato_assegnazione, ore_totali').in('formatore_id', (formatori || []).map(f => f.id)).in('stato_assegnazione', ['accettato', 'in_attesa'])
      : Promise.resolve({ data: [] }),
    corsiIds.length > 0
      ? adminQ.from('sessioni').select('id,corso_id,data,ora_inizio,ora_fine,ore,completata').in('corso_id', corsiIds).order('data').order('ora_inizio')
      : Promise.resolve({ data: [] }),
  ])
  const oreErogatePerCorso: Record<string, number> = {}
  for (const s of sessioniErogate || []) {
    oreErogatePerCorso[s.corso_id] = (oreErogatePerCorso[s.corso_id] ?? 0) + Number(s.ore)
  }
  const oreAssegnateMap: Record<string, number> = {}
  for (const f of (formatori || [])) {
    oreAssegnateMap[f.id] = (corsiStatsFormatori || [])
      .filter(c => c.formatore_id === f.id)
      .reduce((sum: number, c: { ore_totali: number | null }) => sum + Number(c.ore_totali ?? 0), 0)
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
      <ProgettoDetailClient
        progetto={progettoFull}
        corsi={corsi || []}
        formatori={formatori || []}
        messaggi={messaggiConLetto}
        referenti={referenti || []}
        finanziamenti={finanziamenti || []}
        partners={(partners || []) as Partner[]}
        catalogo={catalogo || []}
        currentUserId={user.id}
        isSuperAdmin={isSuperAdmin}
        isAdmin={['admin', 'super_admin'].includes(profile.role)}
        questionari={questionari || []}
        oreErogatePerCorso={oreErogatePerCorso}
        oreAssegnateMap={oreAssegnateMap}
        sessioni={tutteSessioni || []}
      />
    </AppLayout>
  )
}
