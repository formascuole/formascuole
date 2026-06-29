import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { calcFinancials, type RegimeFiscale } from '@/lib/economia-utils'
import { EstrattiContoClient } from './EstrattiContoClient'

export interface CorsoECItem {
  corso_id: string
  title: string
  school_name: string
  progetto_id: string
  finanziamento_id: string | null
  finanziamento_nome: string | null
  partner_id: string | null
  partner_nome: string | null
  formatore_id: string
  formatore_nome: string
  regime_fiscale: RegimeFiscale
  rivalsa_iva: boolean
  ha_partita_iva: boolean
  inps_gestione_separata: boolean
  tariffa: number | null
  tariffa_oraria_formatore: number | null
  ore_erogate: number
  anno: string | null
  prima_sessione: string | null
  ultima_sessione: string | null
  // Tutor
  tutor_id: string | null
  tutor_nome: string | null
  ore_tutoraggio: number
  tariffa_tutor: number | null
  regime_fiscale_tutor: RegimeFiscale
  rivalsa_iva_tutor: boolean
  ha_partita_iva_tutor: boolean
  inps_gestione_separata_tutor: boolean
  // Fatturazione scuola
  tariffa_scuola_formatore: number | null
  tariffa_scuola_tutor: number | null
  importo_scuola_formatore: number
  importo_scuola_tutor: number
  totale_fattura_scuola: number
  // Costo formatore
  imponibile: number
  ritenuta: number
  iva: number
  inps: number
  netto: number
  ritenuteIva: number   // backward compat: ritenuta + iva
  // Costo tutor
  imponibile_tutor: number
  ritenuta_tutor: number
  iva_tutor: number
  inps_tutor: number
  netto_tutor: number
  // Margine
  margine: number
  notula_id?: string | null
}

export default async function EstrattiContoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()

  const [
    { data: profilesRaw },
    { data: corsiRaw },
    { data: progettiRaw },
    { data: sessioniRaw },
    { data: finanziamentiRaw },
    { data: partnersRaw },
  ] = await Promise.all([
    admin.from('profiles').select('id, nome, tariffa_oraria_formatore, tariffa_oraria_tutor, regime_fiscale, rivalsa_iva, ha_partita_iva, inps_gestione_separata'),
    admin.from('corsi')
      .select('id, project_id, title, tipo, formatore_id, tutor_id, tutor_previsto, corso_completato, corso_completato_at, tariffa_oraria, tariffa_oraria_tutor, ore_tutoraggio, notula_id')
      .eq('corso_completato', true)
      .not('formatore_id', 'is', null),
    admin.from('progetti').select('id, school_name, finanziamento_id, partner_id'),
    admin.from('sessioni').select('corso_id, ore, data').eq('completata', true),
    admin.from('finanziamenti').select('id, nome, tariffa_formatore_ora, tariffa_tutor_ora'),
    admin.from('partners').select('id, nome').order('nome'),
  ])

  const profiles = profilesRaw ?? []
  const corsi = corsiRaw ?? []
  const progetti = progettiRaw ?? []
  const sessioni = sessioniRaw ?? []
  const finanziamenti = finanziamentiRaw ?? []
  const partners = partnersRaw ?? []

  const profilesMap = new Map(profiles.map(p => [p.id as string, p]))
  const progettiMap = new Map(progetti.map(p => [p.id as string, p]))
  const partnersMap = new Map(partners.map(p => [p.id as string, p]))
  const finanziamentiMap = new Map(finanziamenti.map(f => [f.id as string, f]))

  type SessionAgg = { ore_erogate: number; prima: string | null; ultima: string | null }
  const sessionByCorso = new Map<string, SessionAgg>()
  for (const s of sessioni) {
    const cur = sessionByCorso.get(s.corso_id as string) ?? { ore_erogate: 0, prima: null, ultima: null }
    cur.ore_erogate += Number(s.ore)
    if (!cur.prima || (s.data as string) < cur.prima) cur.prima = s.data as string
    if (!cur.ultima || (s.data as string) > cur.ultima) cur.ultima = s.data as string
    sessionByCorso.set(s.corso_id as string, cur)
  }

  const items: CorsoECItem[] = corsi.map(c => {
    const profileData = profilesMap.get(c.formatore_id as string)
    const tutorData = c.tutor_id ? profilesMap.get(c.tutor_id as string) : undefined
    const progetto = progettiMap.get(c.project_id as string)
    const finId = progetto?.finanziamento_id as string | null | undefined
    const finanziamento = finId ? finanziamentiMap.get(finId) : undefined
    const ptnId = progetto?.partner_id as string | null | undefined
    const partner = ptnId ? partnersMap.get(ptnId) : undefined
    const agg = sessionByCorso.get(c.id as string) ?? { ore_erogate: 0, prima: null, ultima: null }

    // Formatore fiscal
    const regime = ((profileData?.regime_fiscale ?? 'notula') as RegimeFiscale)
    const rivalsa = !!(profileData?.rivalsa_iva)
    const haPiva = !!(profileData?.ha_partita_iva)
    const inpsGs = !!(profileData?.inps_gestione_separata)
    const tariffaProfile = (profileData?.tariffa_oraria_formatore as number | null) ?? null
    const tariffa = (c.tariffa_oraria as number | null) ?? tariffaProfile

    // Tutor fiscal — tutoring billing only for PF tipo with assigned tutor
    const hasTutor = !!c.tutor_id && c.tipo === 'PF'
    const tutorRegime = ((tutorData?.regime_fiscale ?? 'notula') as RegimeFiscale)
    const tutorRivalsa = !!(tutorData?.rivalsa_iva)
    const tutorHaPiva = !!(tutorData?.ha_partita_iva)
    const tutorInpsGs = !!(tutorData?.inps_gestione_separata)
    const tariffaTutorProfile = (tutorData?.tariffa_oraria_tutor as number | null) ?? null
    const tariffa_tutor = hasTutor ? ((c.tariffa_oraria_tutor as number | null) ?? tariffaTutorProfile) : null
    const ore_tutoraggio = hasTutor ? (Number(c.ore_tutoraggio) || 0) : 0

    // Fatturazione scuola
    const tariffa_scuola_formatore = finanziamento ? (finanziamento.tariffa_formatore_ora as number | null) : null
    const tariffa_scuola_tutor = finanziamento ? (finanziamento.tariffa_tutor_ora as number | null) : null
    const importo_scuola_formatore = tariffa_scuola_formatore != null && agg.ore_erogate > 0
      ? agg.ore_erogate * tariffa_scuola_formatore : 0
    const importo_scuola_tutor = tariffa_scuola_tutor != null && ore_tutoraggio > 0
      ? ore_tutoraggio * tariffa_scuola_tutor : 0
    const totale_fattura_scuola = importo_scuola_formatore + importo_scuola_tutor

    const anno = (c.corso_completato_at as string | null)?.substring(0, 4)
      ?? agg.ultima?.substring(0, 4) ?? null

    // Costo formatore
    const fin = tariffa != null && agg.ore_erogate > 0
      ? calcFinancials(agg.ore_erogate, tariffa, regime, rivalsa, inpsGs, haPiva)
      : { imponibile: 0, ritenuteIva: 0, netto: 0, ritenuta: 0, iva: 0, inps: 0 }

    // Costo tutor
    const finTutor = tariffa_tutor != null && ore_tutoraggio > 0
      ? calcFinancials(ore_tutoraggio, tariffa_tutor, tutorRegime, tutorRivalsa, tutorInpsGs, tutorHaPiva)
      : { imponibile: 0, ritenuteIva: 0, netto: 0, ritenuta: 0, iva: 0, inps: 0 }

    const margine = totale_fattura_scuola - fin.netto - finTutor.netto

    return {
      corso_id: c.id as string,
      title: c.title as string,
      school_name: (progetto?.school_name as string | null) ?? '—',
      progetto_id: c.project_id as string,
      finanziamento_id: finId ?? null,
      finanziamento_nome: (finanziamento?.nome as string | null) ?? null,
      partner_id: ptnId ?? null,
      partner_nome: (partner?.nome as string | null) ?? null,
      formatore_id: c.formatore_id as string,
      formatore_nome: (profileData?.nome as string | null) ?? '—',
      regime_fiscale: regime,
      rivalsa_iva: rivalsa,
      ha_partita_iva: haPiva,
      inps_gestione_separata: inpsGs,
      tariffa,
      tariffa_oraria_formatore: tariffaProfile,
      ore_erogate: agg.ore_erogate,
      anno,
      prima_sessione: agg.prima,
      ultima_sessione: agg.ultima,
      tutor_id: hasTutor ? (c.tutor_id as string) : null,
      tutor_nome: hasTutor && tutorData ? (tutorData.nome as string | null) : null,
      ore_tutoraggio,
      tariffa_tutor,
      regime_fiscale_tutor: tutorRegime,
      rivalsa_iva_tutor: tutorRivalsa,
      ha_partita_iva_tutor: tutorHaPiva,
      inps_gestione_separata_tutor: tutorInpsGs,
      tariffa_scuola_formatore,
      tariffa_scuola_tutor,
      importo_scuola_formatore,
      importo_scuola_tutor,
      totale_fattura_scuola,
      imponibile: fin.imponibile,
      ritenuta: fin.ritenuta,
      iva: fin.iva,
      inps: fin.inps,
      netto: fin.netto,
      ritenuteIva: fin.ritenuteIva,
      imponibile_tutor: finTutor.imponibile,
      ritenuta_tutor: finTutor.ritenuta,
      iva_tutor: finTutor.iva,
      inps_tutor: finTutor.inps,
      netto_tutor: finTutor.netto,
      margine,
      notula_id: (c.notula_id as string | null) ?? null,
    }
  })

  const formatori = Array.from(
    new Map(items.map(i => [i.formatore_id, { id: i.formatore_id, nome: i.formatore_nome }])).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome))

  const progettiList = progetti
    .map(p => ({ id: p.id as string, nome: p.school_name as string }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const finanziamentiList = finanziamenti
    .map(f => ({ id: f.id as string, nome: f.nome as string }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const partnersList = partners
    .map(p => ({ id: p.id as string, nome: p.nome as string }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <EstrattiContoClient
        items={items}
        formatori={formatori}
        progetti={progettiList}
        finanziamenti={finanziamentiList}
        partners={partnersList}
      />
    </AppLayout>
  )
}
