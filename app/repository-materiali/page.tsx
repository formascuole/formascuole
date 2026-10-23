import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { RepositoryMaterialiClient } from './RepositoryMaterialiClient'

export interface MaterialeItem {
  id: string
  nome: string
  tipo: 'file' | 'link'
  url: string
  descrizione: string | null
  ordine: number
  created_at: string
  caricato_da: string | null
  caricato_da_nome: string | null
  corso_id: string
  corso_title: string
  corso_tipo: string | null
  progetto_id: string
  school_name: string
  anno_scolastico: string | null
  formatore_id: string | null
  formatore_nome: string | null
}

export default async function RepositoryMaterialiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const notifiche = await getUnreadNotificheCount(supabase, user.id)
  const isSuperAdmin = profile.role === 'super_admin'
  const admin = createAdminClient()

  // Fetch tutti i materiali con join corsi → progetti
  const { data: materialiRaw } = await admin
    .from('materiali_corso')
    .select(`
      id, nome, tipo, url, descrizione, ordine, created_at, caricato_da,
      corsi!corso_id(
        id, title, tipo, project_id, formatore_id,
        progetti!project_id(id, school_name, anno_scolastico)
      )
    `)
    .order('created_at', { ascending: false })

  // Fetch profili per caricato_da e formatori
  const uploaderIds = [...new Set((materialiRaw ?? []).map(m => m.caricato_da).filter(Boolean) as string[])]
  const formatoreIds = [...new Set(
    (materialiRaw ?? [])
      .map(m => (m.corsi as any)?.formatore_id)
      .filter(Boolean) as string[]
  )]
  const allProfileIds = [...new Set([...uploaderIds, ...formatoreIds])]

  const { data: profilesRaw } = allProfileIds.length > 0
    ? await admin.from('profiles').select('id, nome').in('id', allProfileIds)
    : { data: [] }

  const profilesMap = new Map((profilesRaw ?? []).map(p => [p.id as string, p.nome as string]))

  const materiali: MaterialeItem[] = (materialiRaw ?? []).map(m => {
    const corso = m.corsi as any
    const progetto = corso?.progetti as any
    return {
      id: m.id as string,
      nome: m.nome as string,
      tipo: m.tipo as 'file' | 'link',
      url: m.url as string,
      descrizione: (m.descrizione as string | null) ?? null,
      ordine: Number(m.ordine),
      created_at: m.created_at as string,
      caricato_da: (m.caricato_da as string | null) ?? null,
      caricato_da_nome: m.caricato_da ? (profilesMap.get(m.caricato_da as string) ?? null) : null,
      corso_id: corso?.id ?? '',
      corso_title: corso?.title ?? '',
      corso_tipo: corso?.tipo ?? null,
      progetto_id: progetto?.id ?? '',
      school_name: progetto?.school_name ?? '',
      anno_scolastico: progetto?.anno_scolastico ?? null,
      formatore_id: corso?.formatore_id ?? null,
      formatore_nome: corso?.formatore_id ? (profilesMap.get(corso.formatore_id as string) ?? null) : null,
    }
  })

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
      regimeFiscale={profile.regime_fiscale}
    >
      <RepositoryMaterialiClient materiali={materiali} />
    </AppLayout>
  )
}
