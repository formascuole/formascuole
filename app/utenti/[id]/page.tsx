import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
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

  const isSuperAdmin = await checkIsSuperAdmin(user.id)

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

  // Ore erogate come formatore
  const adminQ = createAdminClient()
  const corsiFormatoreIds = (corsiFormatore || []).map(c => c.id)
  const corsiTutorIds = (corsiTutor || []).map(c => c.id)

  const [{ data: sessioniFormatore }, { data: sessioniTutor }, { data: corsiTutorData }] = await Promise.all([
    corsiFormatoreIds.length > 0
      ? adminQ.from('sessioni').select('ore').in('corso_id', corsiFormatoreIds).eq('completata', true)
      : Promise.resolve({ data: [] }),
    corsiTutorIds.length > 0
      ? adminQ.from('sessioni').select('corso_id, ore').in('corso_id', corsiTutorIds).eq('completata', true)
      : Promise.resolve({ data: [] }),
    corsiTutorIds.length > 0
      ? adminQ.from('corsi').select('id, ore_tutoraggio, ore_totali').in('id', corsiTutorIds)
      : Promise.resolve({ data: [] }),
  ])

  const oreErogateFormatore = (sessioniFormatore || []).reduce((s, x) => s + Number(x.ore), 0)

  // Ore tutor erogate: proporzionale per ciascun corso
  const oreCompPerCorso = new Map<string, number>()
  for (const s of sessioniTutor || []) {
    oreCompPerCorso.set(s.corso_id, (oreCompPerCorso.get(s.corso_id) ?? 0) + Number(s.ore))
  }
  const oreErogateTutor = (corsiTutorData || []).reduce((sum, c) => {
    const oreComp = oreCompPerCorso.get(c.id) ?? 0
    if (!c.ore_tutoraggio || !c.ore_totali || Number(c.ore_totali) === 0) return sum
    return sum + Math.round(Number(c.ore_tutoraggio) * (oreComp / Number(c.ore_totali)))
  }, 0)

  // Questionari per questo formatore
  const corsiIds = (corsiFormatore || []).map(c => c.id)
  const [{ data: questionari }, { data: allQuestionari }] = await Promise.all([
    corsiIds.length > 0
      ? adminQ.from('questionari_risultati').select('*').in('corso_id', corsiIds).not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    adminQ.from('questionari_risultati').select('media_formatore,media_contenuti,media_apprendimento,numero_risposte').not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null),
  ])

  const globalTot = (allQuestionari || []).reduce((s, q) => s + (q.numero_risposte ?? 1), 0)
  const globalMedia = globalTot > 0
    ? (allQuestionari || []).reduce((s, q) => {
        const avg = (Number(q.media_formatore ?? 0) + Number(q.media_contenuti ?? 0) + Number(q.media_apprendimento ?? 0)) / 3
        return s + avg * (q.numero_risposte ?? 1)
      }, 0) / globalTot
    : null

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
        questionari={questionari || []}
        mediaGlobale={globalMedia}
        oreErogateFormatore={oreErogateFormatore}
        oreErogateTutor={oreErogateTutor}
      />
    </AppLayout>
  )
}
