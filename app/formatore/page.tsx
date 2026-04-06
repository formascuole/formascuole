import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/AppLayout'
import { FormatoreClient } from './FormatoreClient'

export default async function FormatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'formatore') redirect('/dashboard')

  const { data: corsi } = await supabase
    .from('corsi_con_ore')
    .select('*, progetti(school_name,anno_scolastico,ref_name,ref_email)')
    .eq('formatore_id', user.id)
    .order('created_at')

  return (
    <AppLayout role="formatore" nome={profile.nome} email={profile.email} avatarInitials={profile.avatar_initials}>
      <FormatoreClient corsi={corsi || []} profile={profile} />
    </AppLayout>
  )
}
