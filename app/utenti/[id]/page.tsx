import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { UtenteDetailClient } from './UtenteDetailClient'
import { UserRole } from '@/lib/types'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

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

  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  // Ore erogate come formatore
  const adminQ = createAdminClient()
  const corsiFormatoreIds = (corsiFormatore || []).map(c => c.id)
  const corsiTutorIds = (corsiTutor || []).map(c => c.id)

  const [{ data: sessioniFormatore }, { data: sessioniTutor }, { data: corsiTutorData }] = await Promise.all([
    corsiFormatoreIds.length > 0
      ? adminQ.from('sessioni').select('corso_id, ore, data').in('corso_id', corsiFormatoreIds).eq('completata', true)
      : Promise.resolve({ data: [] }),
    corsiTutorIds.length > 0
      ? adminQ.from('sessioni').select('corso_id, ore').in('corso_id', corsiTutorIds).eq('completata', true)
      : Promise.resolve({ data: [] }),
    corsiTutorIds.length > 0
      ? adminQ.from('corsi').select('id, ore_tutoraggio, ore_totali').in('id', corsiTutorIds)
      : Promise.resolve({ data: [] }),
  ])

  const oreErogatePerCorsoFormatore: Record<string, number> = {}
  let oreErogateFormatore = 0
  for (const s of sessioniFormatore || []) {
    oreErogatePerCorsoFormatore[s.corso_id] = (oreErogatePerCorsoFormatore[s.corso_id] ?? 0) + Number(s.ore)
    oreErogateFormatore += Number(s.ore)
  }

  const sessionDatesByCorso: Record<string, { prima: string; ultima: string }> = {}
  for (const s of sessioniFormatore || []) {
    const sTyped = s as { corso_id: string; ore: number; data: string }
    if (!sTyped.data) continue
    const cur = sessionDatesByCorso[sTyped.corso_id]
    if (!cur) {
      sessionDatesByCorso[sTyped.corso_id] = { prima: sTyped.data, ultima: sTyped.data }
    } else {
      if (sTyped.data < cur.prima) cur.prima = sTyped.data
      if (sTyped.data > cur.ultima) cur.ultima = sTyped.data
    }
  }

  const oreErogatePerCorsoTutor: Record<string, number> = {}
  for (const s of sessioniTutor || []) {
    oreErogatePerCorsoTutor[s.corso_id] = (oreErogatePerCorsoTutor[s.corso_id] ?? 0) + Number(s.ore)
  }

  // Ore tutor erogate totali: proporzionale per ciascun corso
  const oreErogateTutor = (corsiTutorData || []).reduce((sum, c) => {
    const oreComp = oreErogatePerCorsoTutor[c.id] ?? 0
    if (!c.ore_tutoraggio || !c.ore_totali || Number(c.ore_totali) === 0) return sum
    return sum + Math.round(Number(c.ore_tutoraggio) * (oreComp / Number(c.ore_totali)))
  }, 0)

  // Questionari per questo formatore — two-query merge to catch records with corso_id null
  const corsiIds = (corsiFormatore || []).map(c => c.id)
  const [{ data: qByCorso }, { data: qByName }, { data: allQuestionari }] = await Promise.all([
    corsiIds.length > 0
      ? adminQ.from('questionari_risultati').select('*').in('corso_id', corsiIds).not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as import('@/lib/types').QuestionarioRisultato[] }),
    adminQ.from('questionari_risultati').select('*').eq('formatore', profile.nome).not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null).order('created_at', { ascending: false }),
    adminQ.from('questionari_risultati').select('media_formatore,media_contenuti,media_apprendimento,numero_risposte').not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null),
  ])

  const seenQ = new Set<string>()
  const questionari = [...(qByCorso || []), ...(qByName || [])]
    .filter(q => { if (seenQ.has(q.id)) return false; seenQ.add(q.id); return true })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const globalTot = (allQuestionari || []).reduce((s, q) => s + (q.numero_risposte ?? 1), 0)
  const globalMedia = globalTot > 0
    ? (allQuestionari || []).reduce((s, q) => {
        const avg = (Number(q.media_formatore ?? 0) + Number(q.media_contenuti ?? 0) + Number(q.media_apprendimento ?? 0)) / 3
        return s + avg * (q.numero_risposte ?? 1)
      }, 0) / globalTot
    : null

  // Fetch formatore skills and all tags
  const [{ data: skillsData }, { data: allTagsData }] = await Promise.all([
    adminQ.from('formatori_skills').select('tag:tags(id,nome,colore)').eq('formatore_id', id),
    adminQ.from('tags').select('*').order('nome'),
  ])
  const skills = ((skillsData || []) as any[]).map(r => r.tag).filter(Boolean) as import('@/lib/types').Tag[]
  const allTags = (allTagsData || []) as import('@/lib/types').Tag[]

  return (
    <AppLayout
      role={currentProfile.role}
      nome={currentProfile.nome}
      email={currentProfile.email}
      avatarInitials={currentProfile.avatar_initials}
      notificheBadge={notifiche}
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
        oreErogatePerCorsoFormatore={oreErogatePerCorsoFormatore}
        oreErogatePerCorsoTutor={oreErogatePerCorsoTutor}
        isAdmin={['admin', 'super_admin'].includes(currentProfile.role)}
        sessionDatesByCorso={sessionDatesByCorso}
        skills={skills}
        allTags={allTags}
      />
    </AppLayout>
  )
}
