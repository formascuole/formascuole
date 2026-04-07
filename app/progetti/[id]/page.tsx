import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgettoDetailClient } from './ProgettoDetailClient'

export default async function ProgettoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/formatore')

  const { data: progetto } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .eq('id', id)
    .single()

  if (!progetto) notFound()

  const { data: corsi } = await supabase
    .from('corsi_con_ore')
    .select('*, formatore:profiles(id,nome,email,avatar_initials)')
    .eq('project_id', id)
    .order('created_at')

  const { data: formatori } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'formatore')
    .order('nome')

  const { data: messaggi } = await supabase
    .from('chat_messaggi')
    .select('*, autore:profiles(id,nome,avatar_initials)')
    .eq('progetto_id', id)
    .order('created_at', { ascending: true })

  // Fetch which messages the current user has read
  const msgIds = (messaggi || []).map(m => m.id)
  let readSet = new Set<string>()
  if (msgIds.length > 0) {
    const { data: letture } = await supabase
      .from('chat_letture')
      .select('messaggio_id')
      .eq('utente_id', user.id)
      .in('messaggio_id', msgIds)
    readSet = new Set((letture || []).map(l => l.messaggio_id))
  }
  const messaggiConLetto = (messaggi || []).map(m => ({ ...m, letto: readSet.has(m.id) }))

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
      <ProgettoDetailClient
        progetto={progetto}
        corsi={corsi || []}
        formatori={formatori || []}
        messaggi={messaggiConLetto}
        currentUserId={user.id}
      />
    </AppLayout>
  )
}
