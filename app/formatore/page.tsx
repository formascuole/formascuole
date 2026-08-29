import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getLettereCount } from '@/lib/get-lettere-count'
import { FormatoreClient } from './FormatoreClient'
import { NoProfileError } from './NoProfileError'

export default async function FormatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (profile && profile.role === 'tutor') redirect('/tutor')
  if (profile && !['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  if (!profile) {
    return <NoProfileError />
  }

  // Usa il service role client per bypassare RLS sulla view corsi_con_ore
  const admin = createAdminClient()

  // Corsi del formatore — select diretto senza join sulla view (le view non
  // espongono sempre le FK relationship a PostgREST)
  const { data: corsi } = await admin
    .from('corsi_con_ore')
    .select('*')
    .eq('formatore_id', user.id)
    .order('created_at')

  // Fetch dati progetto separatamente
  const projectIds = [...new Set((corsi || []).map(c => c.project_id))]
  type ProgettoRow = {
    id: string; school_name: string; address: string | null
    anno_scolastico: string | null
    ref_name: string; ref_email: string; ref_tel: string | null
    finanziamento_id: string | null
  }
  let progettiRows: ProgettoRow[] = []
  if (projectIds.length > 0) {
    const { data } = await admin
      .from('progetti')
      .select('id, school_name, address, anno_scolastico, ref_name, ref_email, ref_tel, finanziamento_id')
      .in('id', projectIds)
    progettiRows = (data || []) as ProgettoRow[]
  }
  const progettiMap = new Map(progettiRows.map(p => [p.id, p]))

  // Batch-fetch referenti specifici dei corsi
  const referenteIds = [...new Set(
    (corsi || []).filter(c => c.referente_id).map(c => c.referente_id as string)
  )]
  const referentiMap = new Map<string, { id: string; nome: string; email: string; tel?: string }>()
  if (referenteIds.length > 0) {
    const { data: referenti } = await admin
      .from('referenti_progetto')
      .select('id,nome,email,tel')
      .in('id', referenteIds)
    for (const r of referenti || []) referentiMap.set(r.id, r)
  }

  const corsiConReferente = (corsi || []).map(c => ({
    ...c,
    progetti: progettiMap.get(c.project_id) || null,
    referente: c.referente_id ? referentiMap.get(c.referente_id) || null : null,
  }))

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('id,nome')
    .order('nome')

  // Corsi disponibili (candidature aperte, nessun formatore assegnato)
  const { data: corsiAperti } = await admin
    .from('corsi')
    .select('id, title, tipo, ore_totali, project_id, candidature_aperte_at, link_scheda, modalita')
    .eq('candidature_aperte', true)
    .is('formatore_id', null)

  const corsiApertiIds = (corsiAperti || []).map(c => c.id)

  // Fetch scuole per i corsi aperti
  const progettiApertiIds = [...new Set((corsiAperti || []).map(c => c.project_id))]
  type ProgettoApertoRow = { id: string; school_name: string; address: string | null }
  let progettiApertiMap = new Map<string, ProgettoApertoRow>()
  if (progettiApertiIds.length > 0) {
    const { data: progettiAperti } = await admin
      .from('progetti').select('id, school_name, address').in('id', progettiApertiIds)
    for (const p of (progettiAperti || []) as ProgettoApertoRow[]) progettiApertiMap.set(p.id, p)
  }

  // Mie candidature esistenti per questi corsi
  const mieCandidatureSet = new Set<string>()
  if (corsiApertiIds.length > 0) {
    const { data: mieCandidature } = await admin
      .from('candidature_corsi')
      .select('corso_id')
      .eq('formatore_id', user.id)
      .in('corso_id', corsiApertiIds)
    for (const c of mieCandidature || []) mieCandidatureSet.add(c.corso_id)
  }

  const corsiDisponibili = (corsiAperti || []).map(c => {
    const prog = progettiApertiMap.get(c.project_id)
    const address = prog?.address || ''
    const parts = address.split(',')
    const lastPart = parts[parts.length - 1].trim()
    const city = lastPart.replace(/^\d{5}\s*/, '').trim() || address
    return {
      id: c.id,
      title: c.title,
      tipo: c.tipo as string,
      ore_totali: c.ore_totali as number,
      school_name: prog?.school_name || '',
      city: city || null,
      link_scheda: c.link_scheda as string | null,
      modalita: c.modalita as string | null,
      candidature_aperte_at: c.candidature_aperte_at as string | null,
      già_candidato: mieCandidatureSet.has(c.id),
    }
  })

  // Ore erogate per questo formatore (totale + per corso)
  const corsiIds = (corsi || []).map(c => c.id)
  const oreErogatePerCorso: Record<string, number> = {}
  let oreErogate = 0
  if (corsiIds.length > 0) {
    const { data: sessioni } = await admin
      .from('sessioni')
      .select('corso_id, ore')
      .in('corso_id', corsiIds)
      .eq('completata', true)
    for (const s of sessioni || []) {
      oreErogatePerCorso[s.corso_id] = (oreErogatePerCorso[s.corso_id] ?? 0) + Number(s.ore)
      oreErogate += Number(s.ore)
    }
  }

  // Questionari per questo formatore — query both by corso_id and by name to catch
  // records submitted without the platform URL (where corso_id is null but formatore text is set)
  const [byCorso, byName, { data: allQuestionari }] = await Promise.all([
    corsiIds.length > 0
      ? admin.from('questionari_risultati').select('*').in('corso_id', corsiIds).not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as import('@/lib/types').QuestionarioRisultato[] }),
    admin.from('questionari_risultati').select('*').eq('formatore', profile.nome).not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null).order('created_at', { ascending: false }),
    admin.from('questionari_risultati').select('media_formatore,media_contenuti,media_apprendimento,numero_risposte').not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null),
  ])

  const seenQ = new Set<string>()
  const questionari = [...(byCorso.data || []), ...(byName.data || [])]
    .filter(q => { if (seenQ.has(q.id)) return false; seenQ.add(q.id); return true })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const globalTot = (allQuestionari || []).reduce((s, q) => s + (q.numero_risposte ?? 1), 0)
  const mediaGlobale = globalTot > 0
    ? (allQuestionari || []).reduce((s, q) => {
        const avg = (Number(q.media_formatore ?? 0) + Number(q.media_contenuti ?? 0) + Number(q.media_apprendimento ?? 0)) / 3
        return s + avg * (q.numero_risposte ?? 1)
      }, 0) / globalTot
    : null

  const lettereCount = await getLettereCount(admin, user.id, 'formatore')

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials} regimeFiscale={profile.regime_fiscale} lettereCount={lettereCount}>
      <FormatoreClient
        corsi={corsiConReferente}
        profile={profile}
        finanziamenti={finanziamenti || []}
        questionari={questionari || []}
        mediaGlobale={mediaGlobale}
        corsiDisponibili={corsiDisponibili}
        oreErogate={oreErogate}
        oreErogatePerCorso={oreErogatePerCorso}
        documentiCompleti={profile.documenti_completi ?? false}
      />
    </AppLayout>
  )
}
