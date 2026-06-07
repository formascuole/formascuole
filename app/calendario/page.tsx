import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { CalendarioClient, SessioneRow, IndisponibilitaRow } from './CalendarioClient'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const admin = createAdminClient()

  type RawSessione = {
    id: string; data: string; ore: number; completata: boolean; corso_id: string
    corso: { id: string; title: string; project_id: string; formatore_id: string | null; progetti: { school_name: string } | null } | null
  }
  const { data: rawSessioni } = await supabase
    .from('sessioni')
    .select('id, data, ore, completata, corso_id, corso:corsi(id, title, project_id, formatore_id, progetti(school_name))')
    .order('data')

  const { data: allProfiles } = await admin.from('profiles').select('id, nome, role')
  const profilesById = new Map((allProfiles || []).map(p => [p.id, p]))

  const sessioni: SessioneRow[] = ((rawSessioni as unknown as RawSessione[]) || []).map(s => ({
    id: s.id,
    data: s.data,
    ore: Number(s.ore),
    completata: s.completata,
    corso_id: s.corso_id,
    corso_title: s.corso?.title || '—',
    school_name: s.corso?.progetti?.school_name || '—',
    project_id: s.corso?.project_id || '',
    formatore_id: s.corso?.formatore_id || null,
    formatore_nome: s.corso?.formatore_id ? (profilesById.get(s.corso.formatore_id)?.nome ?? null) : null,
  }))

  type RawInd = { id: string; formatore_id: string; data: string; fascia: string; note: string | null }
  const { data: rawInd } = await admin
    .from('indisponibilita_formatori')
    .select('id, formatore_id, data, fascia, note')
    .order('data')

  const indisponibilita: IndisponibilitaRow[] = (rawInd as RawInd[] || []).map(i => ({
    id: i.id,
    formatore_id: i.formatore_id,
    formatore_nome: profilesById.get(i.formatore_id)?.nome ?? null,
    data: i.data,
    fascia: i.fascia as IndisponibilitaRow['fascia'],
    note: i.note,
  }))

  const formatori = (allProfiles || [])
    .filter(p => p.role === 'formatore')
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map(p => ({ id: p.id, nome: p.nome }))

  const { data: progetti } = await supabase
    .from('progetti')
    .select('id, school_name')
    .order('school_name')

  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
    >
      <CalendarioClient
        initialSessioni={sessioni}
        initialIndisponibilita={indisponibilita}
        formatori={formatori}
        progetti={(progetti || []).map(p => ({ id: p.id, school_name: p.school_name }))}
        currentUserId={user.id}
      />
    </AppLayout>
  )
}
