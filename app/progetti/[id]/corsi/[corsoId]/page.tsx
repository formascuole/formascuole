import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { CorsoDetailClient } from './CorsoDetailClient'

export default async function CorsoDetailPage({
  params,
}: {
  params: Promise<{ id: string; corsoId: string }>
}) {
  const { id, corsoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/formatore')

  const { data: corso } = await supabase
    .from('corsi_con_ore')
    .select('*, formatore:profiles(id,nome,email,avatar_initials)')
    .eq('id', corsoId)
    .single()

  if (!corso || corso.project_id !== id) notFound()

  const { data: progetto } = await supabase.from('progetti').select('school_name,anno_scolastico,ref_name,ref_email').eq('id', id).single()

  const { data: sessioni } = await supabase
    .from('sessioni')
    .select('*')
    .eq('corso_id', corsoId)
    .order('data')

  const { data: formatori } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'formatore')
    .order('nome')

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  return (
    <AppLayout
      role="admin"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
    >
      <CorsoDetailClient
        corso={corso}
        progetto={progetto}
        sessioni={sessioni || []}
        formatori={formatori || []}
        progettoId={id}
      />
    </AppLayout>
  )
}
