import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { TutorClient } from './TutorClient'

export default async function TutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (profile.role !== 'tutor') redirect('/formatore')

  // Usa il service role client per bypassare RLS
  const admin = createAdminClient()

  const { data: corsi } = await admin
    .from('corsi_con_ore')
    .select('*, progetti(id,school_name,address,anno_scolastico,ref_name,ref_email,ref_tel,finanziamento_id), formatore:profiles!formatore_id(id,nome,email,avatar_initials)')
    .eq('tutor_id', user.id)
    .order('created_at', { ascending: false })

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
    referente: c.referente_id ? referentiMap.get(c.referente_id) || null : null,
  }))

  const { data: finanziamenti } = await supabase
    .from('finanziamenti')
    .select('id,nome')
    .order('nome')

  return (
    <AppLayout
      role="tutor"
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
    >
      <TutorClient corsi={corsiConReferente} profile={profile} finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
