import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from './OnboardingClient'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Admins/super_admin non passano per onboarding
  if (['admin', 'super_admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Già completato → vai alla home ruolo
  if (profile.profilo_completo && profile.password_cambiata) {
    redirect(profile.role === 'tutor' ? '/tutor' : '/formatore')
  }

  // Determina lo step iniziale dal DB (non dal query param, per sicurezza)
  const initialStep = !profile.password_cambiata ? 1 : 2

  return (
    <OnboardingClient
      nome={profile.nome}
      email={profile.email}
      initialStep={initialStep}
      profile={{
        luogo_nascita: profile.luogo_nascita ?? '',
        data_nascita: profile.data_nascita ?? '',
        codice_fiscale: profile.codice_fiscale ?? '',
        indirizzo_via: profile.indirizzo_via ?? '',
        indirizzo_cap: profile.indirizzo_cap ?? '',
        indirizzo_citta: profile.indirizzo_citta ?? '',
        indirizzo_provincia: profile.indirizzo_provincia ?? '',
        iban: profile.iban ?? '',
        banca: profile.banca ?? '',
        intestatario_conto: profile.intestatario_conto ?? '',
      }}
      redirectTo={profile.role === 'tutor' ? '/tutor' : '/formatore'}
    />
  )
}
