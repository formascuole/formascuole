import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DocumentiClient } from './DocumentiClient'

export default async function OnboardingDocumentiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, password_cambiata, profilo_completo, documenti_completi, cv_url, ci_url, cf_url, cv_uploaded_at, ci_uploaded_at, cf_uploaded_at, nome, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!['formatore', 'tutor'].includes(profile.role)) redirect('/dashboard')
  if (!profile.password_cambiata || !profile.profilo_completo) redirect('/onboarding')
  if (profile.documenti_completi) redirect('/formatore')

  const redirectTo = profile.role === 'tutor' ? '/tutor' : '/formatore'

  return (
    <DocumentiClient
      nome={profile.nome}
      email={profile.email}
      cvUrl={profile.cv_url ?? null}
      ciUrl={profile.ci_url ?? null}
      cfUrl={profile.cf_url ?? null}
      cvUploadedAt={profile.cv_uploaded_at ?? null}
      ciUploadedAt={profile.ci_uploaded_at ?? null}
      cfUploadedAt={profile.cf_uploaded_at ?? null}
      redirectTo={redirectTo}
    />
  )
}
