import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { LettereIncaricoClient } from './LettereIncaricoClient'

export interface LetteraItem {
  corso_id: string
  corso_title: string
  school_name: string
  progetto_id: string
  tipo: 'formatore' | 'tutor'
  persona_id: string
  persona_nome: string
  persona_email: string
  url: string
  firmata: boolean
  firmata_at: string | null
  firmata_ip: string | null
  anno: string | null
}

export default async function LettereIncaricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()

  const { data: corsiRaw } = await admin
    .from('corsi')
    .select(`
      id, title, project_id, created_at,
      formatore_id, lettera_incarico_url, lettera_incarico_firmata, lettera_incarico_firmata_at, lettera_incarico_ip,
      tutor_id,     lettera_tutor_url,    lettera_tutor_firmata,    lettera_tutor_firmata_at,    lettera_tutor_ip
    `)
    .or('lettera_incarico_url.not.is.null,lettera_tutor_url.not.is.null')
    .order('created_at', { ascending: false })

  const corsi = corsiRaw || []

  const projectIds = [...new Set(corsi.map(c => c.project_id as string))]
  const personaIds = [
    ...new Set([
      ...corsi.filter(c => c.formatore_id).map(c => c.formatore_id as string),
      ...corsi.filter(c => c.tutor_id).map(c => c.tutor_id as string),
    ])
  ]

  const [progettiRes, profilesRes] = await Promise.all([
    projectIds.length > 0
      ? admin.from('progetti').select('id, school_name, anno_scolastico').in('id', projectIds)
      : Promise.resolve({ data: [] }),
    personaIds.length > 0
      ? admin.from('profiles').select('id, nome, email').in('id', personaIds)
      : Promise.resolve({ data: [] }),
  ])

  const progettiMap = new Map((progettiRes.data || []).map(p => [p.id, p]))
  const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p]))

  const items: LetteraItem[] = []

  for (const c of corsi) {
    const progetto = progettiMap.get(c.project_id as string)
    const school_name = (progetto?.school_name as string) ?? '—'
    const anno = (progetto?.anno_scolastico as string | null) ?? null

    if (c.lettera_incarico_url && c.formatore_id) {
      const formatore = profilesMap.get(c.formatore_id as string)
      items.push({
        corso_id: c.id as string,
        corso_title: c.title as string,
        school_name,
        progetto_id: c.project_id as string,
        tipo: 'formatore',
        persona_id: c.formatore_id as string,
        persona_nome: (formatore?.nome as string) ?? '—',
        persona_email: (formatore?.email as string) ?? '—',
        url: c.lettera_incarico_url as string,
        firmata: (c.lettera_incarico_firmata as boolean) ?? false,
        firmata_at: (c.lettera_incarico_firmata_at as string | null) ?? null,
        firmata_ip: (c.lettera_incarico_ip as string | null) ?? null,
        anno,
      })
    }

    if (c.lettera_tutor_url && c.tutor_id) {
      const tutor = profilesMap.get(c.tutor_id as string)
      items.push({
        corso_id: c.id as string,
        corso_title: c.title as string,
        school_name,
        progetto_id: c.project_id as string,
        tipo: 'tutor',
        persona_id: c.tutor_id as string,
        persona_nome: (tutor?.nome as string) ?? '—',
        persona_email: (tutor?.email as string) ?? '—',
        url: c.lettera_tutor_url as string,
        firmata: (c.lettera_tutor_firmata as boolean) ?? false,
        firmata_at: (c.lettera_tutor_firmata_at as string | null) ?? null,
        firmata_ip: (c.lettera_tutor_ip as string | null) ?? null,
        anno,
      })
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
      <LettereIncaricoClient items={items} />
    </AppLayout>
  )
}
