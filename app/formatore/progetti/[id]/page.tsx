import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getLettereCount } from '@/lib/get-lettere-count'
import { ProgettoFormatoreClient } from './ProgettoFormatoreClient'

export default async function ProgettoFormatorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: progettoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (profile.role === 'tutor') redirect('/tutor')
  if (!['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()

  // Fetch project details
  const { data: progetto } = await admin
    .from('progetti')
    .select('id,school_name,address,ref_name,ref_email,ref_tel,finanziamento_id')
    .eq('id', progettoId)
    .single()

  if (!progetto) redirect('/formatore/progetti')

  // Verify formatore has at least one course in this project
  const { data: corsi } = await admin
    .from('corsi_con_ore')
    .select('*')
    .eq('formatore_id', user.id)
    .eq('project_id', progettoId)
    .order('created_at')

  if (!corsi || corsi.length === 0) redirect('/formatore/progetti')

  // Fetch referenti specifici dei corsi
  const referenteIds = [...new Set(corsi.filter(c => c.referente_id).map(c => c.referente_id as string))]
  const referentiMap = new Map<string, { id: string; nome: string; email: string; tel?: string }>()
  if (referenteIds.length > 0) {
    const { data: referenti } = await admin
      .from('referenti_progetto')
      .select('id,nome,email,tel')
      .in('id', referenteIds)
    for (const r of referenti || []) referentiMap.set(r.id, r)
  }

  const corsiConReferente = corsi.map(c => ({
    ...c,
    referente: c.referente_id ? referentiMap.get(c.referente_id) || null : null,
  }))

  const { data: finanziamenti } = await supabase.from('finanziamenti').select('id,nome').order('nome')

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials} regimeFiscale={profile.regime_fiscale} lettereCount={await getLettereCount(admin, user.id, 'formatore')}>
      <ProgettoFormatoreClient
        progetto={progetto}
        corsi={corsiConReferente}
        finanziamenti={finanziamenti || []}
        formatoreNome={profile.nome}
      />
    </AppLayout>
  )
}
