import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { DocumentiContabiliClient } from './DocumentiContabiliClient'
import { calcFinancials } from '@/lib/economia-utils'
import type { Notula } from '@/lib/types'

export interface NotuleAdminItem extends Notula {
  formatore_nome: string
  formatore_email: string
  formatore_regime: 'notula' | 'forfettario' | 'ordinario'
  n_corsi: number
}

export interface FatturaAtteseItem {
  corso_id: string
  title: string
  school_name: string
  formatore_id: string
  formatore_nome: string
  regime: 'forfettario' | 'ordinario'
  rivalsa_iva: boolean
  ore_erogate: number
  tariffa: number | null
  imponibile: number
  iva: number
  netto: number
  fattura_ricevuta: boolean
  fattura_ricevuta_at: string | null
  anno: string | null
}

export interface RiepilogoItem {
  formatore_id: string
  formatore_nome: string
  regime: 'notula' | 'forfettario' | 'ordinario'
  n_corsi: number
  totale_lordo: number
  totale_ritenute: number
  totale_iva: number
  totale_netto: number
  stato: 'ok' | 'in_attesa' | 'da_verificare'
}

export default async function DocumentiContabiliPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()

  // ── Tab 1: Notule ─────────────────────────────────────────────────────────
  const { data: notuleRaw } = await admin
    .from('notule')
    .select('*, formatore:profiles!formatore_id(id, nome, email, regime_fiscale), corsi:notule_corsi(corso_id, importo, ore_erogate)')
    .order('created_at', { ascending: false })

  const notule: NotuleAdminItem[] = (notuleRaw || []).map(n => ({
    id: n.id as string,
    numero: n.numero as string,
    formatore_id: n.formatore_id as string,
    stato: n.stato as 'bozza' | 'inviata' | 'accettata' | 'rifiutata',
    tipo: n.tipo as 'singola' | 'cumulativa',
    importo_totale: n.importo_totale as number | null,
    ritenuta: n.ritenuta as number | null,
    iva: (n.iva as number) ?? 0,
    netto: n.netto as number | null,
    pdf_url: n.pdf_url as string | null,
    token: n.token as string | null,
    inviata_at: n.inviata_at as string | null,
    risposta_at: n.risposta_at as string | null,
    motivazione_rifiuto: n.motivazione_rifiuto as string | null,
    created_at: n.created_at as string,
    formatore_nome: (n.formatore as { nome: string } | null)?.nome ?? '—',
    formatore_email: (n.formatore as { email: string } | null)?.email ?? '—',
    formatore_regime: ((n.formatore as { regime_fiscale?: string } | null)?.regime_fiscale ?? 'notula') as 'notula' | 'forfettario' | 'ordinario',
    n_corsi: Array.isArray(n.corsi) ? n.corsi.length : 0,
  }))

  // ── Tab 2: Fatture attese (P.IVA formatori) ───────────────────────────────
  const { data: pivaProfiles } = await admin
    .from('profiles')
    .select('id, nome, email, regime_fiscale, rivalsa_iva, tariffa_oraria_formatore')
    .eq('ha_partita_iva', true)
    .neq('regime_fiscale', 'notula')

  const pivaIds = (pivaProfiles || []).map(p => p.id as string)

  let fattureAttese: FatturaAtteseItem[] = []

  if (pivaIds.length > 0) {
    const { data: pivaCorsi } = await admin
      .from('corsi')
      .select('id, project_id, title, formatore_id, tariffa_oraria, fattura_ricevuta, fattura_ricevuta_at, corso_completato_at')
      .eq('corso_completato', true)
      .in('formatore_id', pivaIds)

    const pivaCorsiIds = (pivaCorsi || []).map(c => c.id as string)

    // Fetch sessions
    const sessioniPerCorso = new Map<string, number>()
    if (pivaCorsiIds.length > 0) {
      const { data: pivaSessioni } = await admin
        .from('sessioni')
        .select('corso_id, ore')
        .in('corso_id', pivaCorsiIds)
        .eq('completata', true)
      for (const s of pivaSessioni || []) {
        sessioniPerCorso.set(s.corso_id, (sessioniPerCorso.get(s.corso_id) ?? 0) + Number(s.ore))
      }
    }

    // Fetch school names
    const projectIds = [...new Set((pivaCorsi || []).map(c => c.project_id as string))]
    const progettiMap = new Map<string, string>()
    if (projectIds.length > 0) {
      const { data: progettiData } = await admin
        .from('progetti')
        .select('id, school_name')
        .in('id', projectIds)
      for (const p of progettiData || []) progettiMap.set(p.id, p.school_name as string)
    }

    const pivaProfilesMap = new Map(
      (pivaProfiles || []).map(p => [p.id as string, p])
    )

    fattureAttese = (pivaCorsi || []).map(c => {
      const piva = pivaProfilesMap.get(c.formatore_id as string)
      const ore = sessioniPerCorso.get(c.id as string) ?? 0
      const regime = (piva?.regime_fiscale as 'forfettario' | 'ordinario') ?? 'forfettario'
      const rivalsaIva = (piva?.rivalsa_iva as boolean) ?? false
      const tariffa = c.tariffa_oraria != null
        ? Number(c.tariffa_oraria)
        : (piva?.tariffa_oraria_formatore != null ? Number(piva.tariffa_oraria_formatore) : null)

      const fin = tariffa != null && ore > 0
        ? calcFinancials(ore, tariffa, regime, rivalsaIva)
        : { imponibile: 0, ritenuteIva: 0, netto: 0 }

      return {
        corso_id: c.id as string,
        title: c.title as string,
        school_name: progettiMap.get(c.project_id as string) ?? '—',
        formatore_id: c.formatore_id as string,
        formatore_nome: (piva?.nome as string) ?? '—',
        regime,
        rivalsa_iva: rivalsaIva,
        ore_erogate: ore,
        tariffa,
        imponibile: fin.imponibile,
        iva: regime === 'ordinario' && rivalsaIva ? fin.ritenuteIva : 0,
        netto: fin.netto,
        fattura_ricevuta: (c.fattura_ricevuta as boolean) ?? false,
        fattura_ricevuta_at: (c.fattura_ricevuta_at as string | null) ?? null,
        anno: c.corso_completato_at ? (c.corso_completato_at as string).substring(0, 4) : null,
      }
    })
  }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <DocumentiContabiliClient
        notule={notule}
        fattureAttese={fattureAttese}
      />
    </AppLayout>
  )
}
