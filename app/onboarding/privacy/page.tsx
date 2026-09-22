import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrivacyClient } from './PrivacyClient'
import { PRIVACY_POLICY_TEXT } from '@/lib/privacy-policy'

export default async function PrivacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, privacy_accettata')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (['admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')
  if (profile.privacy_accettata) redirect('/onboarding')

  return <PrivacyClient policyText={PRIVACY_POLICY_TEXT} />
}
