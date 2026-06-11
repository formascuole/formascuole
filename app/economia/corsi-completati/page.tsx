import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { calcFinancials } from '@/lib/economia-utils'
import { CorsiCompletatiClient } from './CorsiCompletatiClient'

export interface CorsoEconRow {
  id: string
  title: string
  tipo: 'PF' | 'Lab'
  ore_totali: number
  school_name: string
  progetto_id: string
  formatore_nome: string | null
  formatore_id: string | null
  linea_finanziamento: string | null
  ore_pianificate: number
  ore_erogate: number
  pct: number
  stato: 'da_pianificare' | 'in_corso' | 'completato' | 'confermato'
  prima_sessione: string | null
  ultima_sessione: string | null
  // financial extras
  regime_fiscale: 'forfettario' | 'ordinario' | 'notula' | null
  rivalsa_iva: boolean
  tariffa: number | null           // corso.tariffa_oraria ?? profile.tariffa_oraria_formatore
  importo: number | null           // ore_erogate × tariffa (null if no tariffa)
  ritenuteIva: number | null
  netto: number | null
}

function getStato(
  c: { calendario_confermato?: boolean | null; ore_totali: number },
  orePian: number,
  oreEr: number
): 'da_pianificare' | 'in_corso' | 'completato' | 'confermato' {
  if (c.calendario_confermato) return 'confermato'
  if (Number(c.ore_totali) > 0 && oreEr >= Number(c.ore_totali)) return 'completato'
  if (orePian > 0) return 'in_corso'
  return 'da_pianificare'
}

export default async function CorsiCompletatiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const isSuperAdmin = await checkIsSuperAdmin(user.id)
  const notifiche = await getUnreadNotificheCount(supabase, user.id)

  const admin = createAdminClient()

  const [
    { data: corsiRaw },
    { data: sessioniRaw },
    { data: progettiRaw },
    { data: finanziamentiRaw },
    { data: profilesRaw },
  ] = await Promise.all([
    admin.from('corsi').select('id, project_id, title, tipo, ore_totali, formatore_id, calendario_confermato, tariffa_oraria').order('created_at', { ascending: false }),
    admin.from('sessioni').select('corso_id, ore, data, completata'),
    admin.from('progetti').select('id, school_name, finanziamento_id'),
    admin.from('finanziamenti').select('id, nome').eq('attivo', true),
    admin.from('profiles').select('id, nome, tariffa_oraria_formatore, regime_fiscale, rivalsa_iva').in('role', ['formatore', 'admin', 'super_admin']),
  ])

  const corsi = corsiRaw || []
  const sessioni = sessioniRaw || []
  const progetti = progettiRaw || []
  const finanziamenti = finanziamentiRaw || []
  const profiles = profilesRaw || []

  const progettiMap = new Map(progetti.map(p => [p.id, p]))
  const finanziamentiMap = new Map(finanziamenti.map(f => [f.id, f.nome as string]))
  const profilesMap = new Map(profiles.map(p => [p.id, p]))

  type SessioniAgg = {
    ore_pianificate: number
    ore_erogate: number
    prima_sessione: string | null
    ultima_sessione: string | null
  }
  const sessioniByCorso = new Map<string, SessioniAgg>()
  for (const s of sessioni) {
    const cur = sessioniByCorso.get(s.corso_id) ?? {
      ore_pianificate: 0,
      ore_erogate: 0,
      prima_sessione: null,
      ultima_sessione: null,
    }
    cur.ore_pianificate += Number(s.ore)
    if (s.completata) {
      cur.ore_erogate += Number(s.ore)
      if (s.data) {
        if (!cur.prima_sessione || s.data < cur.prima_sessione) cur.prima_sessione = s.data
        if (!cur.ultima_sessione || s.data > cur.ultima_sessione) cur.ultima_sessione = s.data
      }
    }
    sessioniByCorso.set(s.corso_id, cur)
  }

  const rows: CorsoEconRow[] = corsi.map(c => {
    const progetto = progettiMap.get(c.project_id)
    const agg = sessioniByCorso.get(c.id) ?? {
      ore_pianificate: 0,
      ore_erogate: 0,
      prima_sessione: null,
      ultima_sessione: null,
    }
    const oreTot = Number(c.ore_totali)
    const pct = oreTot > 0 && agg.ore_pianificate > 0
      ? Math.round((agg.ore_pianificate / oreTot) * 100)
      : 0
    const finanziamentoNome = progetto?.finanziamento_id
      ? (finanziamentiMap.get(progetto.finanziamento_id) ?? null)
      : null

    const profileData = c.formatore_id ? profilesMap.get(c.formatore_id) : undefined
    const regime = (profileData?.regime_fiscale ?? null) as 'forfettario' | 'ordinario' | 'notula' | null
    const rivalsa = profileData?.rivalsa_iva ?? false
    const tariffaProfile = (profileData?.tariffa_oraria_formatore as number | null) ?? null
    const tariffa = (c.tariffa_oraria as number | null) ?? tariffaProfile

    let importo: number | null = null
    let ritenuteIva: number | null = null
    let netto: number | null = null

    if (tariffa != null && agg.ore_erogate > 0 && regime != null) {
      const fin = calcFinancials(agg.ore_erogate, tariffa, regime, rivalsa)
      importo = fin.imponibile
      ritenuteIva = fin.ritenuteIva
      netto = fin.netto
    }

    return {
      id: c.id,
      title: c.title,
      tipo: c.tipo as 'PF' | 'Lab',
      ore_totali: oreTot,
      school_name: progetto?.school_name ?? '—',
      progetto_id: c.project_id,
      formatore_nome: c.formatore_id ? (profileData?.nome as string | null) ?? null : null,
      formatore_id: c.formatore_id ?? null,
      linea_finanziamento: finanziamentoNome,
      ore_pianificate: agg.ore_pianificate,
      ore_erogate: agg.ore_erogate,
      pct,
      stato: getStato(c, agg.ore_pianificate, agg.ore_erogate),
      prima_sessione: agg.prima_sessione,
      ultima_sessione: agg.ultima_sessione,
      regime_fiscale: regime,
      rivalsa_iva: rivalsa,
      tariffa,
      importo,
      ritenuteIva,
      netto,
    }
  })

  const formatoriList = Array.from(
    new Map(
      rows
        .filter(r => r.formatore_id != null)
        .map(r => [r.formatore_id!, { id: r.formatore_id!, nome: r.formatore_nome! }])
    ).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome))

  const scuoleSet = new Set(rows.map(r => r.school_name).filter(s => s !== '—'))
  const scuole = [...scuoleSet].sort()

  const finanziamentiList = finanziamenti.map(f => ({ id: f.id, nome: f.nome as string }))

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche}
      isSuperAdmin={isSuperAdmin}
    >
      <CorsiCompletatiClient
        corsi={rows}
        formatori={formatoriList}
        scuole={scuole}
        finanziamenti={finanziamentiList}
      />
    </AppLayout>
  )
}
