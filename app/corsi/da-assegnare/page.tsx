import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { DaAssegnareClient, type CorsoDA, type CorsoInAttesaDA, type ProgettoDA, type FormatoreDA } from './DaAssegnareClient'

export const dynamic = 'force-dynamic'

export default async function DaAssegnarePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nome, email, avatar_initials')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role as string)) redirect('/formatore')

  const admin = createAdminClient()

  const [
    { data: progettiRaw },
    { data: corsiAllRaw },
    { data: corsiInAttesaRaw },
    { data: finanziamentiRaw },
    { data: formatoriProfilesRaw },
    { data: formatoriRolesRaw },
    notifiche,
  ] = await Promise.all([
    admin.from('progetti').select('id, school_name, status, address, finanziamento_id, regione, provincia, is_subappalto').in('status', ['active', 'pending']),
    admin.from('corsi').select('id, title, tipo, ore_totali, modalita, edizione, project_id, tariffa_oraria').is('formatore_id', null),
    admin.from('corsi').select('id, title, tipo, ore_totali, modalita, edizione, project_id, formatore_id, notificato, lettera_incarico_inviata_at').not('formatore_id', 'is', null).eq('stato_assegnazione', 'in_attesa'),
    admin.from('finanziamenti').select('id, nome').eq('attivo', true).order('nome'),
    admin.from('profiles').select('id, nome, email, avatar_initials, tariffa_oraria_formatore, regione, indirizzo_citta, indirizzo_provincia').order('nome'),
    admin.from('profiles_roles').select('profile_id').eq('role', 'formatore'),
    getUnreadNotificheCount(supabase, user.id),
  ])

  const activeProgettoIds = new Set((progettiRaw || []).map(p => p.id as string))
  const corsiFiltered = (corsiAllRaw || []).filter(c => activeProgettoIds.has(c.project_id as string))
  const corsiInAttesaFiltered = (corsiInAttesaRaw || []).filter(c => activeProgettoIds.has(c.project_id as string))

  const formatoreIdSet = new Set((formatoriRolesRaw || []).map((r: { profile_id: string }) => r.profile_id))
  const formatori = (formatoriProfilesRaw || []).filter(f => formatoreIdSet.has(f.id))

  const formatoriMapById = new Map((formatoriProfilesRaw || []).map(f => [f.id as string, f]))

  const corsiIds = corsiFiltered.map(c => c.id as string)
  const formatoriIds = formatori.map(f => f.id)

  let corsiTagsMap: Record<string, string[]> = {}
  let formatoriSkills: Record<string, string[]> = {}
  let oreAssegnateMap: Record<string, number> = {}

  const [corsiTagsRes, skillsRes, corsiStatsRes] = await Promise.all([
    corsiIds.length > 0
      ? admin.from('corsi_tags').select('corso_id, tag_id').in('corso_id', corsiIds)
      : Promise.resolve({ data: [] as { corso_id: string; tag_id: string }[] }),
    formatoriIds.length > 0
      ? admin.from('formatori_skills').select('formatore_id, tag_id').in('formatore_id', formatoriIds)
      : Promise.resolve({ data: [] as { formatore_id: string; tag_id: string }[] }),
    formatoriIds.length > 0
      ? admin.from('corsi').select('formatore_id, stato_assegnazione, ore_totali').in('formatore_id', formatoriIds)
      : Promise.resolve({ data: [] as { formatore_id: string; stato_assegnazione: string | null; ore_totali: number | null }[] }),
  ])

  for (const r of (corsiTagsRes.data || [])) {
    const cid = r.corso_id as string
    if (!corsiTagsMap[cid]) corsiTagsMap[cid] = []
    corsiTagsMap[cid].push(r.tag_id as string)
  }
  for (const r of (skillsRes.data || [])) {
    const fid = r.formatore_id as string
    if (!formatoriSkills[fid]) formatoriSkills[fid] = []
    formatoriSkills[fid].push(r.tag_id as string)
  }
  for (const f of formatori) {
    oreAssegnateMap[f.id] = ((corsiStatsRes.data || []) as { formatore_id: string; stato_assegnazione: string | null; ore_totali: number | null }[])
      .filter(c => c.formatore_id === f.id && (c.stato_assegnazione === 'accettato' || c.stato_assegnazione === 'in_attesa'))
      .reduce((sum, c) => sum + Number(c.ore_totali ?? 0), 0)
  }

  const corsi: CorsoDA[] = corsiFiltered.map(c => ({
    id: c.id as string,
    title: c.title as string,
    tipo: c.tipo as string | null,
    ore_totali: Number(c.ore_totali),
    modalita: c.modalita as string | null,
    edizione: (c as any).edizione as string | null ?? null,
    project_id: c.project_id as string,
    tariffa_oraria: c.tariffa_oraria != null ? Number(c.tariffa_oraria) : null,
    tags: corsiTagsMap[c.id as string] || [],
  }))

  const progetti: ProgettoDA[] = (progettiRaw || []).map(p => ({
    id: p.id as string,
    school_name: p.school_name as string,
    status: p.status as 'active' | 'pending',
    address: p.address as string | null,
    finanziamento_id: p.finanziamento_id as string | null,
    regione: p.regione as string | null,
    provincia: p.provincia as string | null,
    is_subappalto: Boolean((p as any).is_subappalto),
  }))

  const corsiInAttesa: CorsoInAttesaDA[] = corsiInAttesaFiltered.map(c => {
    const f = formatoriMapById.get(c.formatore_id as string)
    return {
      id: c.id as string,
      title: c.title as string,
      tipo: c.tipo as string | null,
      ore_totali: Number(c.ore_totali),
      modalita: c.modalita as string | null,
      edizione: (c as any).edizione as string | null ?? null,
      project_id: c.project_id as string,
      formatore_id: c.formatore_id as string,
      formatore_nome: f?.nome as string ?? '',
      formatore_email: f?.email as string ?? '',
      notificato: Boolean((c as any).notificato),
      lettera_incarico_inviata_at: (c as any).lettera_incarico_inviata_at as string | null ?? null,
    }
  })

  const formatoriClean: FormatoreDA[] = formatori.map(f => ({
    id: f.id,
    nome: f.nome as string,
    email: f.email as string,
    avatar_initials: f.avatar_initials as string,
    tariffa_oraria_formatore: f.tariffa_oraria_formatore != null ? Number(f.tariffa_oraria_formatore) : null,
    regione: f.regione as string | null,
    indirizzo_citta: f.indirizzo_citta as string | null,
    indirizzo_provincia: f.indirizzo_provincia as string | null,
  }))

  return (
    <AppLayout
      role={profile.role as 'admin' | 'super_admin'}
      nome={profile.nome as string}
      email={profile.email as string}
      avatarInitials={profile.avatar_initials as string}
      notificheBadge={notifiche}
      daAssegnareCount={corsi.length + corsiInAttesa.length}
    >
      <DaAssegnareClient
        corsi={corsi}
        corsiInAttesa={corsiInAttesa}
        progetti={progetti}
        finanziamenti={(finanziamentiRaw || []).map(f => ({ id: f.id as string, nome: f.nome as string }))}
        formatori={formatoriClean}
        formatoriSkills={formatoriSkills}
        oreAssegnateMap={oreAssegnateMap}
      />
    </AppLayout>
  )
}
