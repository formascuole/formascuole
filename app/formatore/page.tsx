import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
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

  // Questionari per questo formatore
  const corsiIds = (corsi || []).map(c => c.id)
  const [{ data: questionari }, { data: allQuestionari }] = await Promise.all([
    corsiIds.length > 0
      ? admin.from('questionari_risultati').select('*').in('corso_id', corsiIds).not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from('questionari_risultati').select('media_formatore,media_contenuti,media_apprendimento,numero_risposte').not('media_formatore', 'is', null).not('media_contenuti', 'is', null).not('media_apprendimento', 'is', null),
  ])

  const globalTot = (allQuestionari || []).reduce((s, q) => s + (q.numero_risposte ?? 1), 0)
  const mediaGlobale = globalTot > 0
    ? (allQuestionari || []).reduce((s, q) => {
        const avg = (Number(q.media_formatore ?? 0) + Number(q.media_contenuti ?? 0) + Number(q.media_apprendimento ?? 0)) / 3
        return s + avg * (q.numero_risposte ?? 1)
      }, 0) / globalTot
    : null

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      <FormatoreClient
        corsi={corsiConReferente}
        profile={profile}
        finanziamenti={finanziamenti || []}
        questionari={questionari || []}
        mediaGlobale={mediaGlobale}
      />
    </AppLayout>
  )
}
