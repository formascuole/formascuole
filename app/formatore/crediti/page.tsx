import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { calcFinancials } from '@/lib/economia-utils'
import { CreditiClient } from './CreditiClient'

export interface CreditoItem {
  corso_id: string
  title: string
  school_name: string
  prima_sessione: string | null
  ultima_sessione: string | null
  ore_erogate: number
  tariffa: number | null
  imponibile: number
  iva: number
  netto: number
  fattura_ricevuta: boolean
  fattura_ricevuta_at: string | null
}

export default async function FormatoreCreditiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (!['formatore', 'admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  // Redirect notula regime to the notule page
  if (profile.regime_fiscale === 'notula' || !profile.regime_fiscale) redirect('/formatore/notule')
  // Redirect if no P.IVA
  if (!profile.ha_partita_iva) redirect('/formatore')

  const admin = createAdminClient()

  // Fetch completed corsi for this formatore
  const { data: corsiRaw } = await admin
    .from('corsi')
    .select('id, title, project_id, tariffa_oraria, corso_completato_at, fattura_ricevuta, fattura_ricevuta_at')
    .eq('formatore_id', user.id)
    .eq('corso_completato', true)
    .order('corso_completato_at', { ascending: false })

  const corsi = corsiRaw || []

  // Fetch progetti for school names
  const projectIds = [...new Set(corsi.map(c => c.project_id as string))]
  const progettiMap = new Map<string, string>()
  if (projectIds.length > 0) {
    const { data: progettiData } = await admin
      .from('progetti')
      .select('id, school_name')
      .in('id', projectIds)
    for (const p of progettiData || []) progettiMap.set(p.id, p.school_name as string)
  }

  // Fetch sessions for these corsi
  const corsiIds = corsi.map(c => c.id as string)
  const sessioniPerCorso = new Map<string, { ore: number; dates: string[] }>()
  if (corsiIds.length > 0) {
    const { data: sessioni } = await admin
      .from('sessioni')
      .select('corso_id, ore, data')
      .in('corso_id', corsiIds)
      .eq('completata', true)
      .order('data')

    for (const s of sessioni || []) {
      const existing = sessioniPerCorso.get(s.corso_id) ?? { ore: 0, dates: [] }
      existing.ore += Number(s.ore)
      existing.dates.push(s.data as string)
      sessioniPerCorso.set(s.corso_id, existing)
    }
  }

  const regime = (profile.regime_fiscale as 'forfettario' | 'ordinario') ?? 'forfettario'
  const rivalsaIva = profile.rivalsa_iva ?? false

  const items: CreditoItem[] = corsi.map(c => {
    const sessInfo = sessioniPerCorso.get(c.id as string) ?? { ore: 0, dates: [] }
    const tariffa = c.tariffa_oraria != null
      ? Number(c.tariffa_oraria)
      : (profile.tariffa_oraria_formatore != null ? Number(profile.tariffa_oraria_formatore) : null)

    const fin = tariffa != null && sessInfo.ore > 0
      ? calcFinancials(sessInfo.ore, tariffa, regime, rivalsaIva)
      : { imponibile: 0, ritenuteIva: 0, netto: 0 }

    const sortedDates = sessInfo.dates.sort()

    return {
      corso_id: c.id as string,
      title: c.title as string,
      school_name: progettiMap.get(c.project_id as string) ?? '—',
      prima_sessione: sortedDates[0] ?? null,
      ultima_sessione: sortedDates[sortedDates.length - 1] ?? null,
      ore_erogate: sessInfo.ore,
      tariffa,
      imponibile: fin.imponibile,
      iva: regime === 'ordinario' && rivalsaIva ? fin.ritenuteIva : 0,
      netto: fin.netto,
      fattura_ricevuta: (c.fattura_ricevuta as boolean) ?? false,
      fattura_ricevuta_at: (c.fattura_ricevuta_at as string | null) ?? null,
    }
  })

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      regimeFiscale={profile.regime_fiscale}
    >
      <CreditiClient
        items={items}
        regime={regime}
        rivalsaIva={rivalsaIva}
      />
    </AppLayout>
  )
}
