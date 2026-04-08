import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatisticheClient } from './StatisticheClient'

export interface FinanziamentoStats {
  id: string
  nome: string
  nProgetti: number
  nCorsi: number
  oreTotali: number
  orePianificate: number
  pct: number
}

export interface FormatoreStatRow {
  id: string
  nome: string
  nCorsi: number
  oreTotali: number
  pct: number
  tassoAccettazione: number | null
  nRifiuti: number
}

export interface MeseStats {
  mese: string
  sessioni: number
  ore: number
}

export interface StatisticheData {
  // Riepilogo
  nProgettiAttivi: number
  nProgettiPending: number
  nProgettiCompletati: number
  nCorsiPF: number
  nCorsiLab: number
  oreTotali: number
  orePianificate: number
  oreCompletate: number
  pctCompletamento: number
  nFormatori: number
  corsiInAttesa: number
  corsiRifiutatiMese: number
  // Per finanziamento
  perFinanziamento: FinanziamentoStats[]
  nCorsiSenzaFinanziamento: number
  // Per formatore
  perFormatore: FormatoreStatRow[]
  // Andamento mensile
  andamentoMensile: MeseStats[]
}

export default async function StatistichePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) redirect('/formatore')

  const { data: superAdminRow } = await supabase
    .from('profiles_roles').select('role').eq('profile_id', user.id).eq('role', 'super_admin').maybeSingle()
  const isSuperAdmin = profile.role === 'super_admin' || !!superAdminRow

  const { count: notifiche } = await supabase
    .from('solleciti_log').select('*', { count: 'exact', head: true }).eq('tipo', 'sollecito_3')

  const admin = createAdminClient()

  // 12 months ago (for monthly chart)
  const twelveAgo = new Date()
  twelveAgo.setMonth(twelveAgo.getMonth() - 11)
  twelveAgo.setDate(1); twelveAgo.setHours(0, 0, 0, 0)

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0)

  const [
    { data: progetti },
    { data: corsi },
    { data: allSessioni },
    { data: finanziamenti },
    { data: progettiBase },
    { data: rifiutiLog },
  ] = await Promise.all([
    admin.from('progetti_con_stats').select('*'),
    admin.from('corsi').select('id, project_id, tipo, ore_totali, formatore_id, stato_assegnazione, accettazione_risposta_at'),
    admin.from('sessioni').select('corso_id, ore, completata, data'),
    admin.from('finanziamenti').select('id, nome').eq('attivo', true),
    admin.from('progetti').select('id, finanziamento_id'),
    admin.from('solleciti_log').select('corso_id, formatore_id').eq('tipo', 'assegnazione'),
  ])

  const corsiList = corsi || []
  const sessioniList = allSessioni || []
  const progettiList = (progetti || []) as (typeof progetti extends (infer T)[] | null ? T : never)[]

  // ── ore per corso ────────────────────────────────────────────────────────────
  const orePianMap = new Map<string, number>()
  for (const s of sessioniList) {
    orePianMap.set(s.corso_id, (orePianMap.get(s.corso_id) ?? 0) + Number(s.ore))
  }

  // ── Riepilogo ────────────────────────────────────────────────────────────────
  const nProgettiAttivi   = progettiList.filter(p => p.status === 'active').length
  const nProgettiPending  = progettiList.filter(p => p.status === 'pending').length
  const nProgettiCompletati = progettiList.filter(p => p.status === 'completed').length

  const nCorsiPF  = corsiList.filter(c => c.tipo === 'PF').length
  const nCorsiLab = corsiList.filter(c => c.tipo === 'Lab').length

  const oreTotali = corsiList.reduce((s, c) => s + Number(c.ore_totali), 0)
  const orePianificate = corsiList.reduce((s, c) => s + (orePianMap.get(c.id) ?? 0), 0)
  const oreCompletate = sessioniList.filter(s => s.completata).reduce((s, x) => s + Number(x.ore), 0)
  const pctCompletamento = oreTotali > 0 ? Math.round((orePianificate / oreTotali) * 100) : 0

  // Formatori unici con almeno 1 corso assegnato
  const formatoriUnici = new Set(corsiList.filter(c => c.formatore_id).map(c => c.formatore_id))
  const nFormatori = formatoriUnici.size

  const corsiInAttesa = corsiList.filter(c => c.stato_assegnazione === 'in_attesa').length
  const corsiRifiutatiMese = corsiList.filter(c =>
    c.stato_assegnazione === 'rifiutato' &&
    c.accettazione_risposta_at &&
    new Date(c.accettazione_risposta_at) >= thisMonthStart
  ).length

  // ── Per finanziamento ─────────────────────────────────────────────────────────
  const finMap = new Map((finanziamenti || []).map(f => [f.id, f.nome]))
  const projFinMap = new Map((progettiBase || []).map(p => [p.id, p.finanziamento_id as string | null]))

  const finStats = new Map<string, { nome: string; nProgetti: number; nCorsi: number; oreTotali: number; orePianificate: number }>()
  for (const p of progettiList) {
    const finId = projFinMap.get(p.id)
    if (!finId || !finMap.has(finId)) continue
    const key = finId
    const existing = finStats.get(key) ?? { nome: finMap.get(finId)!, nProgetti: 0, nCorsi: 0, oreTotali: 0, orePianificate: 0 }
    existing.nProgetti++
    finStats.set(key, existing)
  }
  for (const c of corsiList) {
    const finId = projFinMap.get(c.project_id)
    if (!finId || !finStats.has(finId)) continue
    const st = finStats.get(finId)!
    st.nCorsi++
    st.oreTotali += Number(c.ore_totali)
    st.orePianificate += orePianMap.get(c.id) ?? 0
  }

  const perFinanziamento: FinanziamentoStats[] = [...finStats.entries()].map(([id, s]) => ({
    id,
    nome: s.nome,
    nProgetti: s.nProgetti,
    nCorsi: s.nCorsi,
    oreTotali: s.oreTotali,
    orePianificate: s.orePianificate,
    pct: s.oreTotali > 0 ? Math.round((s.orePianificate / s.oreTotali) * 100) : 0,
  })).sort((a, b) => b.oreTotali - a.oreTotali)

  const nCorsiSenzaFinanziamento = corsiList.filter(c => {
    const finId = projFinMap.get(c.project_id)
    return !finId || !finMap.has(finId)
  }).length

  // ── Per formatore ─────────────────────────────────────────────────────────────
  type FmAcc = { nCorsi: number; oreTotali: number; orePian: number; accettati: number; rifiutati: number }
  const fmAcc = new Map<string, FmAcc>()

  for (const c of corsiList) {
    if (!c.formatore_id) continue
    const s = fmAcc.get(c.formatore_id) ?? { nCorsi: 0, oreTotali: 0, orePian: 0, accettati: 0, rifiutati: 0 }
    s.nCorsi++
    s.oreTotali += Number(c.ore_totali)
    s.orePian += orePianMap.get(c.id) ?? 0
    if (c.stato_assegnazione === 'accettato') s.accettati++
    fmAcc.set(c.formatore_id, s)
  }

  // Rifiutati via solleciti_log
  const rifiutatiCorsiIds = new Set(corsiList.filter(c => c.stato_assegnazione === 'rifiutato').map(c => c.id))
  for (const log of rifiutiLog || []) {
    if (!log.formatore_id || !rifiutatiCorsiIds.has(log.corso_id)) continue
    const s = fmAcc.get(log.formatore_id) ?? { nCorsi: 0, oreTotali: 0, orePian: 0, accettati: 0, rifiutati: 0 }
    s.rifiutati++
    fmAcc.set(log.formatore_id, s)
  }

  // Fetch profiles for formatori IDs
  const formatoriIds = [...fmAcc.keys()]
  let profilesMap = new Map<string, string>()
  if (formatoriIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, nome').in('id', formatoriIds)
    profilesMap = new Map((profiles || []).map(p => [p.id, p.nome]))
  }

  const perFormatore: FormatoreStatRow[] = formatoriIds.map(id => {
    const s = fmAcc.get(id)!
    const totRisposte = s.accettati + s.rifiutati
    return {
      id,
      nome: profilesMap.get(id) ?? '—',
      nCorsi: s.nCorsi,
      oreTotali: s.oreTotali,
      pct: s.oreTotali > 0 ? Math.round((s.orePian / s.oreTotali) * 100) : 0,
      tassoAccettazione: totRisposte > 0 ? Math.round((s.accettati / totRisposte) * 100) : null,
      nRifiuti: s.rifiutati,
    }
  }).sort((a, b) => b.oreTotali - a.oreTotali)

  // ── Andamento mensile ─────────────────────────────────────────────────────────
  const meseAccMap = new Map<string, { sessioni: number; ore: number }>()
  // Build the 12 month labels in order
  const months: string[] = []
  const monthKeys: string[] = []
  const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    d.setDate(1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
    monthKeys.push(key)
    months.push(label)
    meseAccMap.set(key, { sessioni: 0, ore: 0 })
  }

  for (const s of sessioniList) {
    if (!s.completata) continue
    const key = s.data.substring(0, 7) // "YYYY-MM"
    if (meseAccMap.has(key)) {
      const m = meseAccMap.get(key)!
      m.sessioni++
      m.ore += Number(s.ore)
    }
  }

  const andamentoMensile: MeseStats[] = monthKeys.map((key, i) => ({
    mese: months[i],
    sessioni: meseAccMap.get(key)!.sessioni,
    ore: meseAccMap.get(key)!.ore,
  }))

  const data: StatisticheData = {
    nProgettiAttivi, nProgettiPending, nProgettiCompletati,
    nCorsiPF, nCorsiLab,
    oreTotali, orePianificate, oreCompletate, pctCompletamento,
    nFormatori, corsiInAttesa, corsiRifiutatiMese,
    perFinanziamento, nCorsiSenzaFinanziamento,
    perFormatore,
    andamentoMensile,
  }

  return (
    <AppLayout
      role={profile.role}
      nome={profile.nome}
      email={profile.email}
      avatarInitials={profile.avatar_initials}
      notificheBadge={notifiche || 0}
      isSuperAdmin={isSuperAdmin}
    >
      <StatisticheClient data={data} />
    </AppLayout>
  )
}
