import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, checkIsSuperAdmin } from '@/lib/supabase/admin'
import { AppLayout } from '@/components/layout/AppLayout'
import { getUnreadNotificheCount } from '@/lib/notifiche-utils'
import { CorsiStatisticsClient } from './CorsiStatisticsClient'

export interface CorsoStatRow {
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

export default async function CorsiStatPage() {
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
    { data: formatoriFetch },
  ] = await Promise.all([
    admin.from('corsi').select('id, project_id, title, tipo, ore_totali, formatore_id, stato_assegnazione, calendario_confermato, corso_completato, corso_completato_at, tariffa_oraria').order('created_at', { ascending: false }),
    admin.from('sessioni').select('corso_id, ore, data, completata'),
    admin.from('progetti').select('id, school_name, finanziamento_id'),
    admin.from('finanziamenti').select('id, nome').eq('attivo', true),
    admin.from('profiles').select('id, nome').in('role', ['formatore', 'admin', 'super_admin']),
  ])

  const corsi = corsiRaw || []
  const sessioni = sessioniRaw || []
  const progetti = progettiRaw || []
  const finanziamenti = finanziamentiRaw || []
  const formatori = formatoriFetch || []

  // Build lookup maps
  const progettiMap = new Map(progetti.map(p => [p.id, p]))
  const finanziamentiMap = new Map(finanziamenti.map(f => [f.id, f.nome as string]))
  const formatoriMap = new Map(formatori.map(f => [f.id, f.nome as string]))

  // Compute per-corso aggregates
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

  // Build rows
  const rows: CorsoStatRow[] = corsi.map(c => {
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

    return {
      id: c.id,
      title: c.title,
      tipo: c.tipo as 'PF' | 'Lab',
      ore_totali: oreTot,
      school_name: progetto?.school_name ?? '—',
      progetto_id: c.project_id,
      formatore_nome: c.formatore_id ? (formatoriMap.get(c.formatore_id) ?? null) : null,
      formatore_id: c.formatore_id ?? null,
      linea_finanziamento: finanziamentoNome,
      ore_pianificate: agg.ore_pianificate,
      ore_erogate: agg.ore_erogate,
      pct,
      stato: getStato(c, agg.ore_pianificate, agg.ore_erogate),
      prima_sessione: agg.prima_sessione,
      ultima_sessione: agg.ultima_sessione,
    }
  })

  // Derive filter options
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
      <CorsiStatisticsClient
        corsi={rows}
        formatori={formatoriList}
        scuole={scuole}
        finanziamenti={finanziamentiList}
      />
    </AppLayout>
  )
}
