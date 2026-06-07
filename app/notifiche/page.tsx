import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { getUnreadNotificheCount, getLetteIds } from '@/lib/notifiche-utils'
import { NotificheClient } from './NotificheClient'

export default async function NotifichePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin','super_admin'].includes(profile.role)) redirect('/formatore')

  const [notifiche, letteIds, solleciti, corsiCriticiRes] = await Promise.all([
    getUnreadNotificheCount(supabase, user.id),
    getLetteIds(supabase, user.id),
    supabase
      .from('solleciti_log')
      .select('*, formatore:profiles(id,nome,email,avatar_initials), corso:corsi(id,title,project_id,progetti(school_name))')
      .order('sent_at', { ascending: false })
      .limit(100),
    supabase
      .from('solleciti_log')
      .select('corso_id, corso:corsi(id,title,project_id,progetti(school_name)), formatore:profiles(id,nome,email,avatar_initials)')
      .eq('tipo', 'sollecito_3'),
  ])

  const corsiCritici = corsiCriticiRes.data

  return (
    <AppLayout role={profile.role} nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials} notificheBadge={notifiche}>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Notifiche</h1>
          <p className="text-sm text-gray-500 mt-1">Storico email automatiche e solleciti inviati</p>
        </div>

        {/* Alert corsi critici */}
        {(corsiCritici?.length ?? 0) > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <h2 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Corsi con 3 solleciti inviati — nessuna risposta
            </h2>
            <div className="space-y-2">
              {corsiCritici?.map(s => (
                <div key={s.corso_id} className="flex items-center gap-3 bg-white rounded-[7px] px-3 py-2">
                  {s.formatore && (
                    <Avatar nome={(s.formatore as unknown as {nome: string}).nome} id={(s.formatore as unknown as {id: string}).id} initials={(s.formatore as unknown as {avatar_initials: string}).avatar_initials} size="sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{(s.corso as unknown as {title: string})?.title}</div>
                    <div className="text-xs text-gray-400">{(s.formatore as unknown as {nome: string})?.nome} · {((s.corso as unknown as {progetti?: {school_name: string}})?.progetti as unknown as {school_name: string})?.school_name}</div>
                  </div>
                  <span className="text-xs text-red-600 font-medium">Nessuna risposta</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log solleciti — interactive client component */}
        <NotificheClient
          solleciti={(solleciti.data || []) as Parameters<typeof NotificheClient>[0]['solleciti']}
          initialLetteIds={[...letteIds]}
        />
      </div>
    </AppLayout>
  )
}
