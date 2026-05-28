import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkIsSuperAdmin, createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProgettoDetailClient } from './ProgettoDetailClient'

export default async function ProgettoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin','super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)

  const { data: progetto } = await supabase
    .from('progetti_con_stats')
    .select('*')
    .eq('id', id)
    .single()

  if (!progetto) notFound()

  const { data: corsi } = await supabase
    .from('corsi_con_ore')
    .select('*, formatore:profiles!formatore_id(id,nome,email,avatar_initials)')
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

  const { data: referenti } = await supabase
    .from('referenti_progetto')
    .select('*')
    .eq('progetto_id', id)
    .order('created_at')

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('*')
    .order('nome')

  const { data: catalogo } = await supabase
    .from('catalogo_corsi')
    .select('*')
    .eq('attivo', true)
    .order('titolo')

  const { count: notifiche } = await supabase
    .from('solleciti_log')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'sollecito_3')

  // Questionari per tutti i corsi di questo progetto
  const corsiIds = (corsi || []).map(c => c.id)
  const adminQ = createAdminClient()
  const { data: questionari } = corsiIds.length > 0
    ? await adminQ.from('questionari_risultati').select('*').in('corso_id', corsiIds).order('created_at', { ascending: false })
    : { data: [] }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
      isSuperAdmin={isSuperAdmin}
    >
      <ProgettoDetailClient
        progetto={progetto}
        corsi={corsi || []}
        formatori={formatori || []}
        messaggi={messaggiConLetto}
        referenti={referenti || []}
        finanziamenti={finanziamenti || []}
        catalogo={catalogo || []}
        currentUserId={user.id}
        isSuperAdmin={isSuperAdmin}
        questionari={questionari || []}
      />
    </AppLayout>
  )
}
