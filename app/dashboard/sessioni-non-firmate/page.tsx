import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { SessioniNonFirmateClient, type ScuolaConSessioni } from './SessioniNonFirmateClient'

export default async function SessioniNonFirmatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [notifiche, { data: sessioniRaw, error }] = await Promise.all([
    getUnreadNotificheCount(supabase, user.id),
    admin
      .from('sessioni')
      .select(`
        id, data, ora_inizio, ore,
        corsi!corso_id(
          id, title, corso_completato,
          profiles!formatore_id(id, nome, email),
          progetti!project_id(id, school_name, anno_scolastico)
        )
      `)
      .lt('data', today)
      .or('completata.is.null,completata.eq.false')
      .order('data', { ascending: true }),
  ])

  if (error) console.error('[sessioni-non-firmate]', error.message)

  // Escludi corsi completati e raggruppa
  type RawSessione = {
    id: string
    data: string
    ora_inizio: string | null
    ore: number
    corsi: {
      id: string
      title: string
      corso_completato: boolean | null
      profiles: { id: string; nome: string; email: string } | null
      progetti: { id: string; school_name: string; anno_scolastico: string | null } | null
    } | null
  }

  const filtered = ((sessioniRaw || []) as unknown as RawSessione[])
    .filter(s => !s.corsi?.corso_completato)

  const byScuolaMap = new Map<string, ScuolaConSessioni>()

  for (const s of filtered) {
    const scuolaId = s.corsi?.progetti?.id ?? 'sconosciuta'
    const scuolaNome = s.corsi?.progetti?.school_name ?? '—'
    const annoScolastico = s.corsi?.progetti?.anno_scolastico ?? null
    const corsoId = s.corsi?.id ?? '—'
    const corsoTitle = s.corsi?.title ?? '—'
    const formatore = s.corsi?.profiles?.nome ?? null
    const formatoreEmail = s.corsi?.profiles?.email ?? null

    if (!byScuolaMap.has(scuolaId)) {
      byScuolaMap.set(scuolaId, { school_name: scuolaNome, anno_scolastico: annoScolastico, corsi: [] })
    }
    const scuola = byScuolaMap.get(scuolaId)!
    let corso = scuola.corsi.find(c => c.corso_id === corsoId)
    if (!corso) {
      corso = { corso_id: corsoId, corso_title: corsoTitle, formatore, formatore_email: formatoreEmail, sessioni: [] }
      scuola.corsi.push(corso)
    }
    corso.sessioni.push({ id: s.id, data: s.data, ora_inizio: s.ora_inizio, ore: s.ore })
  }

  const scuole = Array.from(byScuolaMap.values())
    .sort((a, b) => a.school_name.localeCompare(b.school_name))

  const totaleSessioni = filtered.length

  // Aggiungi corsi da assegnare per nav badge
  const { data: corsiRaw } = await admin
    .from('corsi')
    .select('id, project_id, formatore_id')
  const { data: progettiRaw } = await admin
    .from('progetti')
    .select('id, status')
  const activeIds = new Set((progettiRaw || []).filter(p => p.status === 'active' || p.status === 'pending').map(p => p.id))
  const daAssegnareCount = (corsiRaw || []).filter(c => !c.formatore_id && activeIds.has(c.project_id as string)).length

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      daAssegnareCount={daAssegnareCount}
    >
      <SessioniNonFirmateClient
        scuole={scuole}
        totaleSessioni={totaleSessioni}
        dataRiferimento={today}
      />
    </AppLayout>
  )
}
