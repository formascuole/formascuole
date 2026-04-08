import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const { data: corsi } = await supabase
    .from('corsi_con_ore')
    .select('*, progetti(id,school_name,address,anno_scolastico,ref_name,ref_email,ref_tel,finanziamento_id)')
    .eq('formatore_id', user.id)
    .order('created_at')

  // Fetch referenti specifici dei corsi (override del referente principale)
  const referenteIds = [...new Set((corsi || []).filter(c => c.referente_id).map(c => c.referente_id as string))]
  let referentiMap = new Map<string, { id: string; nome: string; email: string; tel?: string }>()
  if (referenteIds.length > 0) {
    const { data: referenti } = await supabase
      .from('referenti_progetto')
      .select('id,nome,email,tel')
      .in('id', referenteIds)
    for (const r of referenti || []) referentiMap.set(r.id, r)
  }

  // Fetch finanziamenti per i badge
  const { data: finanziamenti } = await supabase.from('finanziamenti').select('id,nome').order('nome')

  const corsiConReferente = (corsi || []).map(c => ({
    ...c,
    referente: c.referente_id ? referentiMap.get(c.referente_id) || null : null,
  }))

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      <FormatoreClient corsi={corsiConReferente} profile={profile} finanziamenti={finanziamenti || []} />
    </AppLayout>
  )
}
